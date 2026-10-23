
import cv2

camera = cv2.VideoCapture(0, cv2.CAP_DSHOW)

if not camera.isOpened():
    print("ERROR: Camera could not be opened.")
    raise SystemExit(1)

print("Camera opened successfully!")
print("Press Q to exit.")

try:
    while True:
        success, frame = camera.read()

        if not success:
            print("Failed to read camera frame.")
            break

        frame = cv2.flip(frame, 1)

        cv2.putText(
            frame,
            "Face Attendance - Webcam Test",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 0),
            2
        )

        cv2.imshow("Camera Test", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

finally:
    camera.release()
    cv2.destroyAllWindows()
