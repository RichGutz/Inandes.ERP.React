# make_favicon_transparent.py
import os
from PIL import Image

def convert_white_to_transparent():
    input_path = r"C:\Users\rguti\Inandes.Inversionistas.React\public\FAVICON.GEEKSOFT.png"
    output_path = r"C:\Users\rguti\Inandes.Inversionistas.React\public\FAVICON.GEEKSOFT.png"
    
    if not os.path.exists(input_path):
        print(f"Error: No se encontró el archivo en {input_path}")
        return
        
    print(f"Abriendo {input_path}...")
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()
    
    newData = []
    # Umbral para detectar pixeles blancos o muy cercanos al blanco
    threshold = 240
    
    for item in datas:
        # item es un tuple (R, G, B, A)
        r, g, b, a = item
        # Si es blanco o muy claro, lo hacemos transparente
        if r >= threshold and g >= threshold and b >= threshold:
            newData.append((255, 255, 255, 0)) # Transparente
        else:
            newData.append(item) # Mantener pixel original
            
    img.putdata(newData)
    img.save(output_path, "PNG")
    print(f"Favicon guardado exitosamente con fondo transparente en {output_path}")

if __name__ == "__main__":
    convert_white_to_transparent()
