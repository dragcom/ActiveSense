import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from mediapipe import solutions
from mediapipe.framework.formats import landmark_pb2

def draw_landmarks_on_image(rgb_image, detection_result):
    pose_landmarks_list = detection_result.pose_landmarks
    # Convert RGB to BGR for OpenCV drawing
    annotated_image = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR)

    for idx in range(len(pose_landmarks_list)):
        pose_landmarks = pose_landmarks_list[idx]

        # Draw the pose landmarks
        pose_landmarks_proto = landmark_pb2.NormalizedLandmarkList()
        pose_landmarks_proto.landmark.extend([
            landmark_pb2.NormalizedLandmark(x=landmark.x, y=landmark.y, z=landmark.z) 
            for landmark in pose_landmarks
        ])
        
        solutions.drawing_utils.draw_landmarks(
            annotated_image,
            pose_landmarks_proto,
            solutions.pose.POSE_CONNECTIONS,
            solutions.drawing_styles.get_default_pose_landmarks_style())

    return annotated_image

# 1. Setup Detector
base_options = python.BaseOptions(model_asset_path='pose_landmarker.task')
options = vision.PoseLandmarkerOptions(
    base_options=base_options,
    output_segmentation_masks=True)
detector = vision.PoseLandmarker.create_from_options(options)

# 2. Load Image (Ensure image.jpg is in the same folder)
image = mp.Image.create_from_file("image.jpeg")

# 3. Detect
detection_result = detector.detect(image)

# 4. Process and Visualize
annotated_image_bgr = draw_landmarks_on_image(image.numpy_view(), detection_result)

# --- LOCAL DISPLAY LOGIC ---
cv2.imshow("Pose Detection", annotated_image_bgr)

# This is critical: waitKey(0) keeps the window open until you press a key
cv2.waitKey(0)
cv2.destroyAllWindows()