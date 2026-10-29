"""
Generate FoodKey launch banner in 3 formats:
  • poster   — portrait (WhatsApp / print / general)
  • instagram — square 1:1 (Instagram feed)
  • story    — vertical 9:16 (Instagram Story + WhatsApp Status)

Run:
  python3 /app/scripts/generate_launch_banner.py                # all 3
  python3 /app/scripts/generate_launch_banner.py poster story   # subset
Output dir: /app/generated_assets/
"""
import asyncio
import base64
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv("/app/backend/.env")

OUT_DIR = Path("/app/generated_assets")
OUT_DIR.mkdir(parents=True, exist_ok=True)

COMMON_BRAND_RULES = """
Brand & content rules (MUST FOLLOW exactly, character-by-character — the non-brand text
is in TAMIL SCRIPT and must be rendered letter-perfect):

- Brand wordmark (KEEP IN ENGLISH): "FoodKey" — "Food" in bright orange,
  "Key" in dark charcoal.
- Brand tagline directly under the wordmark (KEEP IN ENGLISH, tiny uppercase,
  letter-spaced): "UNLOCK DELICIOUS"
- Website URL (KEEP IN ENGLISH, orange, friendly type, small globe icon):
  "www.foodkey.in"
- Phone number (digits only, KEEP AS-IS): 9566722970

- All other announcement text MUST BE IN TAMIL SCRIPT (Unicode), rendered with a
  clean Tamil display font. Do NOT translate into English, do NOT transliterate
  into Latin letters. Spell each Tamil word exactly as shown:

  Top ribbon headline:
      நமது வாழப்பாடியில் புதிய ஆரம்பம்

  Friendly tagline under the headline:
      வீட்டிலிருந்து உங்களுக்கு விருப்பமான உணவை ஆர்டர் செய்யுங்கள்

  Launch date starburst badge (Tamil + digits):
      மே 18, 2026 முதல்

  Partner CTA (bottom torn-paper strip, TWO lines):
      Line A: டெலிவரி பார்ட்னர் மற்றும் உங்கள் ஹோட்டலை இணைக்க விருப்பமா?
      Line B: Call 9566722970

- Illustrations: South Indian food (dosa, idli, biryani bowl, filter coffee) +
  a small delivery scooter with a 'FoodKey' delivery bag.

Style: warm, cheerful, hand-drawn-ish village-notice feel. NOT luxury / NOT premium
/ NOT sleek / NOT metallic. Colour palette: cream / ivory background, vivid orange
accents, mustard yellow highlights, friendly brown text. Soft polka-dot or dotted-paper
texture in the background.

Typography: friendly rounded sans-serif for English (brand + URL + phone).
For Tamil, use a clear Tamil display / handwritten-style font with proper ligatures —
make sure every Tamil character is correctly formed (கா, கு, கூ etc.) and do NOT
invent nonsense Tamil glyphs.

FINAL CHECK before rendering: the English tokens FoodKey, UNLOCK DELICIOUS,
www.foodkey.in, Call, 9566722970 must appear in ENGLISH only; every other string
must appear in TAMIL SCRIPT only.
"""

VARIANTS = {
    "poster": {
        "suffix": "",   # keeps existing filename foodkey_launch_banner.jpg
        "prompt_intro": (
            "Portrait orientation 2:3 (approx 1024x1536) — a Tamil-language community "
            "launch poster. Vertical flow from top to bottom: top ribbon with the Tamil "
            "headline → Tamil friendly tagline → LARGE 'FoodKey' wordmark in English "
            "with 'UNLOCK DELICIOUS' tagline RIGHT BELOW IT (do not skip this tagline) "
            "→ English website URL www.foodkey.in → starburst with Tamil launch date → "
            "food illustrations + scooter → torn-paper partner CTA strip with Tamil "
            "line + 'Call 9566722970' in English. CRITICAL: spell the Tamil place name "
            "EXACTLY as வாழப்பாடி (va-zha-p-paa-di, with only ONE 'வா' and NO extra "
            "'வாழி' form). Do NOT forget 'UNLOCK DELICIOUS' under the FoodKey wordmark."
        ),
    },
    "instagram": {
        "suffix": "_instagram_square",
        "prompt_intro": (
            "Square 1:1 format (1080x1080) optimised for Instagram feed post, Tamil "
            "community launch flyer. Compact balanced layout: top third = Tamil ribbon "
            "headline + Tamil friendly tagline. Middle = LARGE 'FoodKey' wordmark "
            "(English, do NOT include the word 'BIG'), 'UNLOCK DELICIOUS' tagline in "
            "English, website www.foodkey.in in English, and a starburst with the Tamil "
            "launch date 'மே 18, 2026 முதல்' beside the wordmark. Flank with small "
            "illustrations of dosa, idli, biryani, filter coffee and a delivery scooter. "
            "Bottom strip: torn-paper look with the Tamil partner line + 'Call 9566722970' "
            "in English. Keep all text clearly legible at 500x500 px."
        ),
    },
    "story": {
        "suffix": "_story_vertical",
        "prompt_intro": (
            "Vertical 9:16 format (1080x1920) Tamil launch poster optimised for "
            "Instagram Stories & WhatsApp Status. Tall layout with generous vertical "
            "spacing: top celebration ribbon with Tamil headline, then Tamil friendly "
            "tagline, then LARGE 'FoodKey' wordmark in English (do NOT include 'BIG'), "
            "'UNLOCK DELICIOUS' in English and www.foodkey.in in English, then a bold "
            "central starburst with Tamil launch date 'மே 18, 2026 முதல்', then South "
            "Indian food illustrations and a delivery scooter arranged vertically, and "
            "the bottom torn-paper strip with the Tamil partner invitation + 'Call "
            "9566722970' in English. Keep important text within the central safe-zone "
            "(avoid extreme top and bottom 15%) so that Instagram UI chrome does not "
            "hide it."
        ),
    },
}


async def generate_variant(name: str, spec: dict):
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        print("ERROR: EMERGENT_LLM_KEY missing from /app/backend/.env", file=sys.stderr)
        sys.exit(1)

    chat = LlmChat(
        api_key=api_key,
        session_id=f"foodkey-launch-banner-{name}",
        system_message=(
            "You are a friendly illustrator creating warm, welcoming, hand-drawn-style "
            "community announcement posters for a small South Indian town."
        ),
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
        modalities=["image", "text"]
    )

    prompt = f"{spec['prompt_intro']}\n\n{COMMON_BRAND_RULES}"
    print(f"\n→ [{name}] requesting image from Gemini Nano Banana…")
    msg = UserMessage(text=prompt)
    text, images = await chat.send_message_multimodal_response(msg)

    if text:
        print(f"  model text: {text[:150]}")
    if not images:
        print(f"  ERROR: no images returned for variant '{name}'", file=sys.stderr)
        return False

    img = images[0]
    ext = "png" if "png" in img.get("mime_type", "image/png") else "jpg"
    out_path = OUT_DIR / f"foodkey_launch_banner{spec['suffix']}.{ext}"
    out_path.write_bytes(base64.b64decode(img["data"]))
    print(f"  saved → {out_path} ({out_path.stat().st_size // 1024} KB)")
    return True


async def main(requested: list[str]):
    targets = requested or list(VARIANTS.keys())
    unknown = [t for t in targets if t not in VARIANTS]
    if unknown:
        print(f"Unknown variant(s): {unknown}. Valid: {list(VARIANTS.keys())}", file=sys.stderr)
        sys.exit(2)
    results = []
    for t in targets:
        ok = await generate_variant(t, VARIANTS[t])
        results.append((t, ok))
    print("\n=== Summary ===")
    for name, ok in results:
        print(f"  {name}: {'✓' if ok else '✗'}")


if __name__ == "__main__":
    args = [a.lower() for a in sys.argv[1:]]
    asyncio.run(main(args))
