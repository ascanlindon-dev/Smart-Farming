"""Safe, crop-specific leaf-disease recommendation service.

The classifier supplies the disease label.  This module never treats that label as a
severity prediction and never returns a pesticide unless it has an FPA-verified
record for rambutan in the knowledge base.
"""
import base64
import json
import os
from datetime import date


SOURCES = {
    'sooty': {
        'title': 'Mississippi State University Extension: The Plant Doctor: Sooty Mold',
        'url': 'https://extension.msstate.edu/publications/the-plant-doctor-sooty-mold',
    },
    'anthracnose': {
        'title': 'Scientific supporting evidence: Colletotrichum / anthracnose management',
        'url': 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9319655/',
    },
    'fpa': {
        'title': 'Philippine FPA registered products',
        'url': 'https://fpa.da.gov.ph/resources/reports/registered-products/',
    },
}

AI_SEVERITY_LEVELS = {
    'low': 'Low',
    'moderate': 'Moderate',
    'high': 'High',
    'unable to assess': 'Unable to assess',
    'unable_to_assess': 'Unable to assess',
}


def _is_tagalog(language):
    return str(language or '').lower() in ('tl', 'fil', 'tagalog')


def _key(disease):
    text = str(disease or '').lower()
    if 'sooty' in text:
        return 'sooty_mold'
    if 'anthracnose' in text:
        return 'anthracnose'
    if 'algal' in text:
        return 'algal_spot'
    if 'healthy' in text:
        return 'healthy'
    return 'unknown'


def verified_knowledge(disease, language='en'):
    """Only non-chemical management is seeded until a rambutan FPA record is verified."""
    tl = _is_tagalog(language)
    records = {
        'sooty_mold': {
            'assessment': 'May nakitang sintomas ng sooty mold. Karaniwang tumutubo ito sa honeydew na iniiwan ng sucking insects, kaya unahin ang paghahanap ng peste.' if tl else 'Sooty mold symptoms were detected. It commonly grows on honeydew from sucking insects, so finding the pest source is the priority.',
            'actions': ['Suriin ang ilalim ng dahon, batang sanga, at mga sanga para sa aphids, scale insects, whiteflies, at iba pang sucking insects.', 'Kontrolin muna ang nakitang pest infestation.', 'Alisin ang mabigat na balot sa apektadong dahon gamit ang maingat na sanitation.'] if tl else ['Inspect leaf undersides, young shoots, and branches for aphids, scale insects, whiteflies, and other sucking insects.', 'Prioritize management of the identified pest infestation.', 'Use careful sanitation to remove heavy coating from affected leaves.'],
            'prevention': ['Regular na inspeksyon ng mga peste at kalapit na puno.', 'Panatilihing maaliwalas ang canopy.'] if tl else ['Inspect regularly for pests and nearby affected trees.', 'Keep the canopy open for airflow.'],
            'monitoring': ['Bantayan kung may bagong honeydew, peste, o itim na coating sa mga bagong dahon.'] if tl else ['Watch for new honeydew, insects, or black coating on new leaves.'],
            'sources': [SOURCES['sooty'], SOURCES['fpa']],
        },
        'anthracnose': {
            'assessment': 'May dark na patay na spots na tugma sa anthracnose. Mas kailangan ng sanitation at airflow lalo na kapag mainit, mahalumigmig, o maulan.' if tl else 'Dark dead spots are consistent with anthracnose. Sanitation and airflow need closer attention during warm, humid, or rainy conditions.',
            'actions': ['Alisin at itapon nang maayos ang malubhang apektadong dahon o debris.', 'Buksan ang canopy para mas mabilis matuyo ang dahon.', 'Suriin ang kalapit na puno para sa kaparehong sintomas.'] if tl else ['Remove and properly dispose of severely affected leaves or debris.', 'Open the canopy so leaves dry more quickly.', 'Inspect nearby trees for similar symptoms.'],
            'prevention': ['Iwasan ang matagal na pagkabasa ng dahon kung praktikal.', 'Panatilihing malinis ang paligid ng puno.'] if tl else ['Reduce prolonged leaf wetness where practical.', 'Keep the area around the tree sanitary.'],
            'monitoring': ['Bantayan kung lumalaki o nagsasanib ang dark spots at kung natutuyo ang dahon.'] if tl else ['Monitor whether dark spots enlarge or merge and whether leaves begin to dry.'],
            'sources': [SOURCES['anthracnose'], SOURCES['fpa']],
        },
        'algal_spot': {
            'assessment': 'May orange o brown na spots na tugma sa algal spot. Ituon ang pag-aalaga sa airflow, moisture management, at pangkalahatang kalusugan ng puno.' if tl else 'Orange or brown spots are consistent with algal spot. Focus on airflow, moisture management, and overall tree health.',
            'actions': ['Bawasan ang sobrang siksik na dahon para gumanda ang airflow.', 'Alisin lamang ang malubhang apektadong bahagi kung angkop.', 'Suriin ang kalapit na puno.'] if tl else ['Reduce overly dense foliage to improve airflow.', 'Remove only severely affected material when appropriate.', 'Inspect nearby trees.'],
            'prevention': ['Panatilihing malusog at maaliwalas ang puno.', 'I-manage ang labis na moisture kung praktikal.'] if tl else ['Maintain a healthy, open canopy.', 'Manage excess moisture where practical.'],
            'monitoring': ['Bantayan kung dumarami o lumalaki ang orange/brown spots.'] if tl else ['Watch whether orange/brown spots increase in number or size.'],
            'sources': [SOURCES['fpa']],
        },
        'healthy': {
            'assessment': 'Walang malinaw na visible disease sa larawan. Ipagpatuloy ang preventive care at regular na pagmamanman.' if tl else 'No clear visible disease is present in the image. Continue preventive care and regular monitoring.',
            'actions': ['Ipagpatuloy ang regular na inspeksyon at maayos na sanitation.'] if tl else ['Continue regular inspection and good sanitation.'],
            'prevention': ['Panatilihing maaliwalas ang canopy at alagaan nang wasto ang puno.', 'Mas madalas na mag-monitor kapag maulan o mataas ang humidity.'] if tl else ['Maintain an open canopy and proper tree care.', 'Monitor more often during rainy or humid conditions.'],
            'monitoring': ['Bantayan ang bagong dahon para sa spots, coating, o pests.'] if tl else ['Check new leaves for spots, coating, or pests.'],
            'sources': [SOURCES['fpa']],
        },
    }
    return records.get(_key(disease), {
        'assessment': 'Hindi sapat ang impormasyon para sa disease-specific recommendation.' if tl else 'There is not enough information for a disease-specific recommendation.',
        'actions': ['Kumuha ng mas malinaw na larawan ng isang dahon na may sintomas.'] if tl else ['Capture a clearer close-up of one symptomatic leaf.'],
        'prevention': [], 'monitoring': [], 'sources': [SOURCES['fpa']],
    })


def _environment_advice(environment, language):
    tl = _is_tagalog(language)
    humidity = environment.get('humidity')
    rainfall = environment.get('rainfall')
    advice = []
    if isinstance(humidity, (int, float)) and humidity >= 80:
        advice.append('Mataas ang humidity ayon sa available sensor data; palakasin ang airflow at mag-monitor nang mas madalas.' if tl else 'Available sensor data shows high humidity; improve airflow and monitor more often.')
    if isinstance(rainfall, (int, float)) and rainfall > 0:
        advice.append('May naitalang ulan ayon sa available sensor data; iwasan ang matagal na pagkabasa ng dahon kung praktikal.' if tl else 'Available sensor data records rainfall; reduce prolonged leaf wetness where practical.')
    if environment.get('rain_detected') is True:
        advice.append(
            'May ulan na nakita ng sensor. Kung gagamit ng pesticide, sundin ang rainfast interval sa label; hindi ito rekomendasyong mag-apply.'
            if tl else
            'The sensor detects rain. If using a pesticide, follow its label rainfast interval; this is not a recommendation to apply.'
        )
    return advice


def fallback_recommendation(disease, confidence, environment, language):
    tl = _is_tagalog(language)
    knowledge = verified_knowledge(disease, language)
    key = _key(disease)
    healthy = key == 'healthy'
    return {
        'disease': disease,
        'confidence': confidence,
        'severity': {
            'level': 'Low / No visible disease' if healthy else None,
            'label': 'AI Preliminary Severity Assessment',
            'confidence': 'Unavailable',
            'reason': 'Walang multimodal AI assessment; hindi maaasahang matukoy ang severity mula sa classifier lamang.' if tl else 'No multimodal AI assessment is available; severity cannot be reliably determined from the classifier alone.',
        },
        'stage': {
            'label': 'Not assessed',
            'confidence': 'Unavailable',
            'reason': 'Hindi maaasahang matukoy ang stage mula sa classifier lamang.' if tl else 'Stage cannot be reliably determined from the classifier alone.',
        },
        'assessment': knowledge['assessment'],
        'immediate_actions': knowledge['actions'],
        'treatment': {'available': True, 'type': 'Management', 'details': knowledge['actions'][:2]},
        'chemical_treatment': {
            'available': False,
            'verified': False,
            'product': None,
            'message': (
                'Walang verified chemical treatment sa RAMBUTECH knowledge base. Kung may inaasahang ulan, sundin ang rainfast interval sa label ng produkto; hindi rekomendasyon ang ulan lamang para mag-apply.'
                if tl else
                'No verified chemical treatment is available in the RAMBUTECH knowledge base. If rain is expected, follow the product label rainfast interval; rain alone is not a recommendation to apply.'
            ),
        },
        'prevention': knowledge['prevention'],
        'environmental_advice': _environment_advice(environment, language),
        'monitoring': knowledge['monitoring'],
        'when_to_seek_help': 'Kumonsulta sa agricultural technician o plant pathologist kung mabilis kumalat, malawak ang apektadong bahagi, o hindi makilala ang sanhi.' if tl else 'Consult an agricultural technician or plant pathologist if symptoms spread quickly, affect a large area, or the cause cannot be identified.',
        'safety_precautions': ['Huwag gumamit ng pesticide o fungicide kung walang verified rambutan label at application details.', 'Magsuot ng angkop na personal protective equipment kapag humahawak ng anumang farm input.'] if tl else ['Do not use a pesticide or fungicide without a verified rambutan label and application details.', 'Wear appropriate personal protective equipment when handling any farm input.'],
        'sources': knowledge['sources'],
        'source': 'fallback',
        'notice': 'AI recommendation is temporarily unavailable. Showing verified agricultural recommendations.' if not tl else 'Pansamantalang hindi available ang AI recommendation. Ipinapakita ang verified agricultural recommendations.',
    }


def recommend_with_openai(base_recommendation, image_data_url, language):
    """
    Optional OpenAI multimodal recommendation pass.

    The API key stays on the server and is never accepted from
    or sent to the browser.

    Verified treatment information and sources from the fallback
    recommendation are preserved.
    """

    api_key = os.environ.get('OPENAI_API_KEY')

    if not api_key:
        return base_recommendation, False

    try:
        import requests

        prompt = (
            "You are an agricultural decision-support assistant for "
            "rambutan farmers. "
            "Return only valid JSON. "
            "Preserve the supplied disease label. "
            "Do not invent pesticides, fungicides, chemical products, "
            "dosages, PHI, re-entry intervals, registration numbers, "
            "or treatment claims. "
            "Use the supplied disease classification as the primary "
            "diagnosis. "
            "If an image is provided, use it only for a cautious "
            "preliminary severity and stage assessment. "
            "If severity or stage cannot be determined reliably from "
            "the image, clearly say that it cannot be reliably assessed. "
            "Keep the recommendations practical and farmer-friendly. "
            "Return a JSON object containing only: assessment (a short string), "
            "severity (an object with level and reason), and immediate_actions "
            "(an array of at most three short strings). For severity.level, use "
            "exactly one of: Low, Moderate, High, or Unable to assess. "
            "The severity is a preliminary decision-support assessment based on "
            "the supplied disease label, classifier confidence, and available "
            "farm context; do not present it as a confirmed measurement. "
            "Do not include any other fields. "
            "Respond in Filipino/Tagalog when language is 'tl'; "
            "otherwise respond in English.\n\n"
            f"Language: {language}\n"
            f"Verified recommendation data:\n"
            f"{json.dumps(base_recommendation, ensure_ascii=False)}"
        )

        content = [
            {
                'type': 'input_text',
                'text': prompt,
            }
        ]

        # Add the image only when it is a valid-sized data URL.
        if (
            isinstance(image_data_url, str)
            and image_data_url.startswith('data:image/')
        ):
            try:
                _, encoded = image_data_url.split(',', 1)

                # Keep the same approximate safety limit used before.
                if len(encoded) <= 4_000_000:
                    content.append({
                        'type': 'input_image',
                        'image_url': image_data_url,
                    })
            except ValueError:
                pass

        response = requests.post(
            'https://api.openai.com/v1/responses',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            json={
                'model': 'gpt-4.1-mini',
                'input': [
                    {
                        'role': 'user',
                        'content': content,
                    }
                ],
                'text': {
                    'format': {
                        'type': 'json_object',
                    }
                },
                # The browser already has safe fallback guidance. Keep this
                # enhancement concise so the external response returns faster.
                'max_output_tokens': 300,
            },
            # This runs after the classifier result is shown. Allow enough
            # time for a real response instead of falling back too eagerly.
            timeout=25,
        )

        response.raise_for_status()

        payload = response.json()

        # Extract text from the Responses API payload.
        output_text = ''

        for item in payload.get('output', []):
            for output_content in item.get('content', []):
                if output_content.get('type') == 'output_text':
                    output_text += output_content.get('text', '')

        output_text = output_text.strip()

        if not output_text:
            return base_recommendation, False

        ai = json.loads(output_text)

        if not isinstance(ai, dict):
            return base_recommendation, False

        # Reject malformed output before it reaches React. The provider can
        # change only the validated presentation fields requested above.
        assessment = ai.get('assessment')
        severity = ai.get('severity')
        actions = ai.get('immediate_actions')
        severity_level = ''
        severity_reason = ''
        if isinstance(severity, dict):
            severity_level = AI_SEVERITY_LEVELS.get(
                str(severity.get('level') or '').strip().lower(),
                '',
            )
            raw_reason = severity.get('reason')
            if isinstance(raw_reason, str):
                severity_reason = raw_reason.strip()
        if (not isinstance(assessment, str) or not assessment.strip()
                or not severity_level or not severity_reason
                or not isinstance(actions, list) or not 1 <= len(actions) <= 3
                or any(not isinstance(action, str) or not action.strip() for action in actions)):
            return base_recommendation, False
        recommendation = dict(base_recommendation)
        recommendation['severity'] = dict(base_recommendation['severity'])
        recommendation['severity'].update({
            'level': severity_level,
            'reason': severity_reason,
            'source': 'openai',
        })
        recommendation.update({
            'assessment': assessment.strip(),
            'immediate_actions': [action.strip() for action in actions],
            'source': 'openai', 'notice': None,
        })
        return recommendation, True

    except Exception as exc:
        print(f'OpenAI recommendation error: {exc}')
        return base_recommendation, False
