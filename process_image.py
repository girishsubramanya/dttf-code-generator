"""
Designed and Implemented by: Girish Subramanya <girish.subramanya@daimlertruck.com>
Date: 2025-12-23
Version: 1
"""
from PIL import Image
import os

def process_image():
    input_path = 'static/images/DTTF.png'
    logo_output_path = 'static/images/DTTF_logo.png'
    favicon_output_path = 'static/images/favicon.ico'

    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found.")
        return

    try:
        with Image.open(input_path) as img:
            width, height = img.size

            # Crop the bottom 65% (remove top 35%)
            # box = (left, upper, right, lower)
            crop_box = (0, int(height * 0.35), width, height)
            cropped_img = img.crop(crop_box)

            # Save the cropped logo
            cropped_img.save(logo_output_path)
            print(f"Saved cropped logo to {logo_output_path}")

            # Resize for favicon
            favicon_size = (32, 32)
            favicon_img = cropped_img.resize(favicon_size, Image.Resampling.LANCZOS)
            favicon_img.save(favicon_output_path)
            print(f"Saved favicon to {favicon_output_path}")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    process_image()
