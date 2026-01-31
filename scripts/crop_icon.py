from PIL import Image
import sys
import os

def crop_transparency():
    try:
        source = "public/icon_backup.png"
        dest = "public/icon.png"
        
        if not os.path.exists(source):
            print(f"Error: {source} not found. Reverting safety check.")
            return

        print(f"Opening {source}...")
        img = Image.open(source)
        img = img.convert("RGBA") # Ensure alpha channel
        
        print(f"Original size: {img.size}")
        
        # Get bounding box of non-zero alpha
        # getbbox() operates on the whole image, if mostly transparent, it finds the visual content
        bbox = img.getbbox()
        
        if bbox:
            print(f"Found content at: {bbox}")
            # Crop
            cropped = img.crop(bbox)
            print(f"New size: {cropped.size}")
            
            # Save
            cropped.save(dest, "PNG")
            print(f"Saved optimized icon to {dest}")
        else:
            print("Error: Image appears to be fully transparent.")

    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    crop_transparency()
