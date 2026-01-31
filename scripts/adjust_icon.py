from PIL import Image
import os

def adjust_icon():
    src = "public/icon.png"
    if not os.path.exists(src):
        print("Icon not found")
        return

    img = Image.open(src).convert("RGBA")
    w, h = img.size
    
    # Target canvas size (make it square if not)
    size = max(w, h)
    
    # Creating new canvas
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    
    # Scale down the current icon slightly to allow movement without clipping
    # User wants it "aligned" so likely slightly smaller than "MAX possible" is fine 
    # if it means perfect alignment. 
    # Let's scale to 92% size.
    scale_factor = 0.92
    new_w = int(w * scale_factor)
    new_h = int(h * scale_factor)
    
    resized_img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # Calculate position
    # Center horizontally
    x = (size - new_w) // 2
    
    # Vertically: Center + Offset
    # Center y would be (size - new_h) // 2
    # User wants it "down a tiny bit".
    # Let's add 5% of height as offset
    offset_y = int(size * 0.05) 
    y = ((size - new_h) // 2) + offset_y
    
    # Paste
    canvas.paste(resized_img, (x, y), resized_img)
    
    canvas.save(src, "PNG")
    print(f"Adjusted icon: Scaled to {scale_factor*100}% and shifted down by {offset_y}px")

if __name__ == "__main__":
    adjust_icon()
