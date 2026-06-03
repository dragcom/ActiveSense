import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# --- STEP 1: Setup the Detector ---
# Download 'pose_landmarker.task' and put it in the same folder
base_options = python.BaseOptions(model_asset_path='pose_landmarker.task')
options = vision.PoseLandmarkerOptions(
    base_options=base_options,
    output_segmentation_masks=True  # CRITICAL: This enables the mask
)
detector = vision.PoseLandmarker.create_from_options(options)

# --- STEP 2: Load Image ---
# Ensure "image.jpg" exists in your folder
image = mp.Image.create_from_file("image.jpg")

# --- STEP 3: Run Inference ---
detection_result = detector.detect(image)

# --- STEP 4: Process Segmentation (Your Logic) ---
# Check if a mask was actually generated
if detection_result.segmentation_masks:
    # Get the raw mask
    segmentation_mask = detection_result.segmentation_masks[0].numpy_view()
    segmentation_mask = np.squeeze(segmentation_mask)

    # 1. Create the visual version (Standardized to 0-255)
    visualized_mask = (segmentation_mask * 255).astype(np.uint8)
    visualized_mask = np.stack([visualized_mask]*3, axis=-1)

    # 2. Get the original image as a numpy array (BGR for OpenCV)
    original_image = cv2.cvtColor(image.numpy_view(), cv2.COLOR_RGB2BGR)

    # 3. Use the mask to highlight the person
    # Create a 3-channel boolean mask: True where person is detected
    condition = np.stack((segmentation_mask,) * 3, axis=-1) > 0.1
    
    # Create a green canvas the same size as the image
    fg_image = np.zeros(original_image.shape, dtype=np.uint8)
    fg_image[:] = [0, 255, 0] # Green color in BGR

    # Combine: If condition is True (person), use fg_image (green)
    # If condition is False (background), use original_image
    output_image = np.where(condition, fg_image, original_image)

    # --- STEP 5: Local Display ---
    cv2.imshow("Segmentation Mask", output_image)
    
    print("Window opened. Press any key to close.")
    cv2.waitKey(0)
    cv2.destroyAllWindows()
else:
    print("No segmentation mask detected. Check your model or image.")