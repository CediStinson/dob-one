"""Erzeugt die Testbilder in fixtures/. Alle Bilder sind selbst erzeugt (Farbflächen), frei von Rechten.

Die Metadaten bilden reale Muster nach (A1111-Parameter, ComfyUI-Workflow, IPTC-XMP wie bei
Google/Midjourney, C2PA-JUMBF wie bei ChatGPT/Photoshop). Die C2PA-Manifeste sind strukturell
korrekt (JUMBF + CBOR), aber nicht signiert. Ausführen: python3 scripts/make_fixtures.py
"""
import io
import json
import struct
import zlib
from pathlib import Path

from PIL import Image
from PIL.PngImagePlugin import PngInfo

OUT = Path(__file__).resolve().parent.parent / "fixtures"
OUT.mkdir(exist_ok=True)


def base(color=(20, 180, 160), size=(32, 32)):
    return Image.new("RGB", size, color)


def save(name, data: bytes):
    (OUT / name).write_bytes(data)
    print(f"{name}: {len(data)} B")


def to_bytes(img, fmt, **kw):
    buf = io.BytesIO()
    img.save(buf, fmt, **kw)
    return buf.getvalue()


# --- Mini-CBOR (nur Text, Maps, Arrays, kleine Ints) ---
def cbor_head(major, n):
    if n < 24:
        return bytes([(major << 5) | n])
    if n < 256:
        return bytes([(major << 5) | 24, n])
    return bytes([(major << 5) | 25]) + struct.pack(">H", n)


def cbor(v):
    if isinstance(v, str):
        b = v.encode()
        return cbor_head(3, len(b)) + b
    if isinstance(v, int):
        return cbor_head(0, v)
    if isinstance(v, list):
        return cbor_head(4, len(v)) + b"".join(cbor(x) for x in v)
    if isinstance(v, dict):
        return cbor_head(5, len(v)) + b"".join(cbor(k) + cbor(x) for k, x in v.items())
    raise TypeError(v)


# --- JUMBF ---
def box(tbox: bytes, payload: bytes) -> bytes:
    return struct.pack(">I", 8 + len(payload)) + tbox + payload


def jumd(label: str, uuid: bytes = b"c2pa\x00\x11\x00\x10\x80\x00\x00\xaa\x00\x38\x9b\x71") -> bytes:
    return box(b"jumd", uuid + b"\x03" + label.encode() + b"\x00")


def superbox(label, *children):
    return box(b"jumb", jumd(label) + b"".join(children))


def c2pa_store(claim: dict, actions: dict) -> bytes:
    claim_box = superbox("c2pa.claim", box(b"cbor", cbor(claim)))
    actions_box = superbox("c2pa.actions", box(b"cbor", cbor(actions)))
    assertions = superbox("c2pa.assertions", actions_box)
    manifest = superbox("urn:uuid:00000000-0000-4000-8000-000000000001", assertions, claim_box)
    return superbox("c2pa", manifest)


def jpeg_insert(jpeg: bytes, segments: list[bytes]) -> bytes:
    """Fügt Segmente direkt nach SOI ein."""
    return jpeg[:2] + b"".join(segments) + jpeg[2:]


def app(marker: int, payload: bytes) -> bytes:
    return bytes([0xFF, marker]) + struct.pack(">H", len(payload) + 2) + payload


def app11_jumbf(jumbf: bytes, chunk: int = 60000) -> list[bytes]:
    """JPEG-XT-Segmente: 'JP' + Instanz + Paketnummer, Folgesegmente wiederholen LBox/TBox."""
    head, body = jumbf[:8], jumbf[8:]
    segs, seq, first = [], 1, True
    while first or body:
        part, body = body[:chunk], body[chunk:]
        payload = b"JP" + struct.pack(">HI", 1, seq) + head + part
        segs.append(app(0xEB, payload))
        seq += 1
        first = False
    return segs


def xmp_packet(inner: str) -> str:
    return (
        '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>'
        '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
        '<rdf:Description rdf:about="" xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" '
        'xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/">'
        f"{inner}</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end=\"w\"?>"
    )


DST = "http://cv.iptc.org/newscodes/digitalsourcetype/"

# 1) PNG mit AUTOMATIC1111-Parametern
info = PngInfo()
info.add_text(
    "parameters",
    "a teal fox in a forest, photorealistic\nNegative prompt: blurry\n"
    "Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 1234, Size: 512x512, Model: sd_xl_base_1.0",
)
save("png-a1111.png", to_bytes(base(), "PNG", pnginfo=info))

# 2) PNG mit ComfyUI-Workflow
info = PngInfo()
info.add_text("prompt", json.dumps({"3": {"class_type": "KSampler", "inputs": {"seed": 1, "steps": 20}}}))
info.add_text("workflow", json.dumps({"nodes": [{"id": 3, "type": "KSampler"}]}))
save("png-comfyui.png", to_bytes(base(), "PNG", pnginfo=info))

# 3) PNG ohne Metadaten
save("png-plain.png", to_bytes(base((200, 60, 60)), "PNG"))

# 4) PNG mit XMP in iTXt: KI-Montage
info = PngInfo()
info.add_itxt(
    "XML:com.adobe.xmp",
    xmp_packet(f'<Iptc4xmpExt:DigitalSourceType>{DST}compositeWithTrainedAlgorithmicMedia</Iptc4xmpExt:DigitalSourceType>'),
)
save("png-xmp-composite.png", to_bytes(base(), "PNG", pnginfo=info))

# 5) JPEG mit IPTC-XMP wie bei Google ("Made with Google AI")
xmp = xmp_packet(
    f'<Iptc4xmpExt:DigitalSourceType rdf:resource="{DST}trainedAlgorithmicMedia"/>'
    "<photoshop:Credit>Made with Google AI</photoshop:Credit>"
)
seg = app(0xE1, b"http://ns.adobe.com/xap/1.0/\x00" + xmp.encode())
save("jpeg-xmp-google.jpg", jpeg_insert(to_bytes(base(), "JPEG"), [seg]))

# 6) JPEG mit XMP nur Digital Source Type in Attribut-Form (Midjourney-Muster)
xmp = xmp_packet("").replace(
    'rdf:about=""', f'rdf:about="" Iptc4xmpExt:DigitalSourceType="{DST}trainedAlgorithmicMedia"'
)
seg = app(0xE1, b"http://ns.adobe.com/xap/1.0/\x00" + xmp.encode())
save("jpeg-xmp-attr.jpg", jpeg_insert(to_bytes(base(), "JPEG"), [seg]))

# 7) JPEG mit EXIF Software = Adobe Firefly
exif = Image.Exif()
exif[0x0131] = "Adobe Firefly"
save("jpeg-exif-firefly.jpg", to_bytes(base(), "JPEG", exif=exif))

# 8) JPEG Kamera + Lightroom: keine KI
exif = Image.Exif()
exif[0x010F] = "Canon"
exif[0x0110] = "Canon EOS R6"
exif[0x0131] = "Adobe Lightroom Classic 14.0"
save("jpeg-camera.jpg", to_bytes(base((90, 90, 90)), "JPEG", exif=exif))

# 9) JPEG mit C2PA wie ChatGPT
jumbf = c2pa_store(
    {"claim_generator": "ChatGPT", "dc:format": "image/jpeg"},
    {"actions": [{"action": "c2pa.created", "digitalSourceType": DST + "trainedAlgorithmicMedia"}]},
)
save("jpeg-c2pa-chatgpt.jpg", jpeg_insert(to_bytes(base(), "JPEG"), app11_jumbf(jumbf)))

# 10) JPEG mit C2PA wie Photoshop (generative Füllung), auf mehrere APP11-Segmente verteilt
jumbf = c2pa_store(
    {"claim_generator_info": [{"name": "Adobe Photoshop", "version": "26.0"}], "alg": "sha256"},
    {"actions": [
        {"action": "c2pa.opened"},
        {"action": "c2pa.placed", "digitalSourceType": DST + "compositeWithTrainedAlgorithmicMedia"},
    ]},
)
save("jpeg-c2pa-photoshop.jpg", jpeg_insert(to_bytes(base(), "JPEG"), app11_jumbf(jumbf, chunk=40)))

# 11) JPEG mit C2PA ohne KI-Aussage (Kamera-Signatur)
jumbf = c2pa_store({"claim_generator": "Leica M11-P"}, {"actions": [{"action": "c2pa.created", "digitalSourceType": DST + "digitalCapture"}]})
save("jpeg-c2pa-camera.jpg", jpeg_insert(to_bytes(base((90, 90, 90)), "JPEG"), app11_jumbf(jumbf)))

# 12) WebP mit XMP (Digital Source Type)
xmp = xmp_packet(f'<Iptc4xmpExt:DigitalSourceType>{DST}trainedAlgorithmicMedia</Iptc4xmpExt:DigitalSourceType>')
save("webp-xmp.webp", to_bytes(base(), "WEBP", xmp=xmp.encode()))

# 13) WebP mit EXIF Software = Midjourney
exif = Image.Exif()
exif[0x0131] = "Midjourney"
save("webp-exif-midjourney.webp", to_bytes(base(), "WEBP", exif=exif))
