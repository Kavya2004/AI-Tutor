from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
from io import BytesIO
from PIL import Image
import requests
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

app = Flask(__name__)
CORS(app, origins=['https://tutor.probabilitycourse.com', 'https://ai-tutor-teal-one.vercel.app', 'http://localhost:3000'], supports_credentials=True)

MATHPIX_APP_ID = os.getenv('MATHPIX_APP_ID')
MATHPIX_APP_KEY = os.getenv('MATHPIX_APP_KEY')

MATHPIX_ENDPOINT = 'https://api.mathpix.com/v3/text'


@app.route('/api/ocr', methods=['POST'])
def ocr():
    try:
        data = request.get_json()
        image_data = data.get('image', '').split(',')[1]
        image_bytes = base64.b64decode(image_data)
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')

        headers = {
            'app_id': MATHPIX_APP_ID,
            'app_key': MATHPIX_APP_KEY,
            'Content-type': 'application/json'
        }

        payload = {
            'src': f'data:image/png;base64,{image_base64}',
            'formats': ['text', 'data'],
            'ocr': ['math', 'text']
        }

        response = requests.post(
            MATHPIX_ENDPOINT, json=payload, headers=headers)
        result = response.json()

        return jsonify(result)

    except Exception as e:
        print('[OCR ERROR]', e)
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)
