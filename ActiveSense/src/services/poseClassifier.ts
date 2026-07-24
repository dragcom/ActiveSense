import {
  PoseClassification,
  PoseClassLabel,
  PoseLandmark,
  PoseTrainingSample,
} from '../types';

// The classifier learns one average feature vector for each supported pose label.
type PoseModel = {
  labels: PoseClassLabel[];
  centroids: Record<PoseClassLabel, number[]>;
  ranges: number[];
};

// MediaPipe's 33 landmarks use fixed indexes for major body joints.
const landmarkIndexes = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
};

// Distance helps compare body proportions while including depth when present.
const distance = (a: PoseLandmark, b: PoseLandmark) =>
  Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));

// Midpoints give stable torso and lower-body reference positions.
const midpoint = (a: PoseLandmark, b: PoseLandmark): PoseLandmark => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  z: ((a.z ?? 0) + (b.z ?? 0)) / 2,
});

// Joint angles become compact features that are less sensitive to body size.
const angle = (a: PoseLandmark, b: PoseLandmark, c: PoseLandmark) => {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (!mag) {
    return 0;
  }
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * (180 / Math.PI);
};

// The torso line angle helps separate upright, seated, and floor poses.
const lineAngle = (a: PoseLandmark, b: PoseLandmark) =>
  Math.abs(Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI));

// Low-visibility landmarks are ignored because they often produce noisy form feedback.
const visible = (landmark?: PoseLandmark) => (landmark?.visibility ?? 1) > 0.25;

// Turn a live 33-point pose into numeric features for the simple classifier.
export const extractPoseFeatures = (landmarks: PoseLandmark[]) => {
  if (landmarks.length !== 33) {
    return null;
  }

  const {
    leftShoulder,
    rightShoulder,
    leftElbow,
    rightElbow,
    leftWrist,
    rightWrist,
    leftHip,
    rightHip,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle,
  } = landmarkIndexes;

  const required = [
    leftShoulder,
    rightShoulder,
    leftElbow,
    rightElbow,
    leftWrist,
    rightWrist,
    leftHip,
    rightHip,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle,
  ];

  // If a key limb is missing, avoid guessing and let the UI say it is still tracking.
  if (required.some((index) => !visible(landmarks[index]))) {
    return null;
  }

  // Normalize body-size-dependent values so users with different proportions compare fairly.
  const shoulderMid = midpoint(landmarks[leftShoulder], landmarks[rightShoulder]);
  const hipMid = midpoint(landmarks[leftHip], landmarks[rightHip]);
  const ankleMid = midpoint(landmarks[leftAnkle], landmarks[rightAnkle]);
  const bodyHeight = Math.max(0.001, distance(shoulderMid, ankleMid));
  const shoulderWidth = Math.max(0.001, distance(landmarks[leftShoulder], landmarks[rightShoulder]));
  const hipWidth = Math.max(0.001, distance(landmarks[leftHip], landmarks[rightHip]));

  return [
    angle(landmarks[leftShoulder], landmarks[leftElbow], landmarks[leftWrist]),
    angle(landmarks[rightShoulder], landmarks[rightElbow], landmarks[rightWrist]),
    angle(landmarks[leftHip], landmarks[leftKnee], landmarks[leftAnkle]),
    angle(landmarks[rightHip], landmarks[rightKnee], landmarks[rightAnkle]),
    angle(landmarks[leftShoulder], landmarks[leftHip], landmarks[leftKnee]),
    angle(landmarks[rightShoulder], landmarks[rightHip], landmarks[rightKnee]),
    lineAngle(shoulderMid, hipMid),
    bodyHeight / shoulderWidth,
    (distance(landmarks[leftWrist], landmarks[leftShoulder]) +
      distance(landmarks[rightWrist], landmarks[rightShoulder])) /
      (2 * shoulderWidth),
    distance(hipMid, ankleMid) / hipWidth,
  ];
};

// Build a tiny nearest-centroid model from the seed pose samples.
const trainPoseModel = (samples: PoseTrainingSample[]): PoseModel => {
  const grouped = samples.reduce<Record<string, number[][]>>((groups, sample) => {
    groups[sample.label] = [...(groups[sample.label] ?? []), sample.features];
    return groups;
  }, {});

  const labels = Object.keys(grouped) as PoseClassLabel[];
  const centroids = labels.reduce<Record<PoseClassLabel, number[]>>((result, label) => {
    const labelSamples = grouped[label];
    result[label] = labelSamples[0].map((_, index) => {
      const total = labelSamples.reduce((sum, features) => sum + features[index], 0);
      return total / labelSamples.length;
    });
    return result;
  }, {} as Record<PoseClassLabel, number[]>);

  const featureCount = samples[0]?.features.length ?? 0;
  const ranges = Array.from({ length: featureCount }, (_, index) => {
    const values = samples.map((sample) => sample.features[index]);
    return Math.max(1, Math.max(...values) - Math.min(...values));
  });

  return { labels, centroids, ranges };
};

// Compare features after scaling each dimension by its training range.
const normalizedDistance = (features: number[], centroid: number[], ranges: number[]) =>
  Math.sqrt(
    features.reduce((sum, value, index) => {
      const normalized = (value - centroid[index]) / ranges[index];
      return sum + normalized * normalized;
    }, 0),
  );

// Return a function that classifies live landmarks during a workout session.
export const createPoseClassifier = (samples: PoseTrainingSample[]) => {
  const model = trainPoseModel(samples);

  return (landmarks: PoseLandmark[]): PoseClassification | null => {
    const features = extractPoseFeatures(landmarks);
    if (!features) {
      return null;
    }

    const ranked = model.labels
      .map((label) => ({
        label,
        distance: normalizedDistance(features, model.centroids[label], model.ranges),
      }))
      .sort((a, b) => a.distance - b.distance);

    const best = ranked[0];
    if (!best) {
      return null;
    }

    // Convert distance into a friendly confidence score for the workout UI.
    return {
      label: best.label,
      distance: best.distance,
      confidence: Math.max(0, Math.min(1, 1 / (1 + best.distance))),
    };
  };
};

// Make internal pose labels readable in screen copy.
export const formatPoseClass = (label: PoseClassLabel) =>
  label
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
