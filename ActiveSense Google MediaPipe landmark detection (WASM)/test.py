import cv2

# 1. Load the image
# Make sure "image.jpg" is in the same folder as your script
img = cv2.imread("/Users/yilong/Desktop/NUS COMPUTER SCIENCE/Orbital/Pose_Landmarker/image.jpeg")

# 2. Check if the image loaded correctly
if img is None:
    print("Error: Could not load image. Check the file path.")
else:
    # 3. Display the image in a window titled "Image"
    cv2.imshow("Image", img)

    # 4. Wait for a keystroke (0 means wait indefinitely)
    # Without this, the window will close instantly
    cv2.waitKey(0)

    # 5. Cleanup: close the window after a key is pressed
    cv2.destroyAllWindows()