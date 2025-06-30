from flask import Flask, request, jsonify
from flask_cors import CORS
import easyocr
import base64
from io import BytesIO
from PIL import Image
import numpy as np

app = Flask(__name__)
CORS(app, supports_credentials=True)
reader = easyocr.Reader(['en'])


@app.route('/api/ocr', methods=['POST'])
def ocr():
    try:
        data = request.get_json()
        image_data = data.get('image', '').split(',')[1]
        image_bytes = base64.b64decode(image_data)
        pil_image = Image.open(BytesIO(image_bytes)).convert('RGB')
        np_image = np.array(pil_image)

        result = reader.readtext(np_image)
        text = ' '.join([res[1] for res in result])

        return jsonify({'text': text})

    except Exception as e:
        print('[OCR ERROR]', e)
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)
