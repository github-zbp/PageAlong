import re

SENTENCE_PATTERN = re.compile(r"[^。！？!?？]+[。！？!?？]?")


def split_into_sentences(text: str) -> list[str]:
    paragraphs = [re.sub(r"[ \t]+", " ", line).strip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    sentences = [
        match.group(0).strip()
        for paragraph in paragraphs
        if paragraph
        for match in SENTENCE_PATTERN.finditer(paragraph)
    ]
    return [sentence for sentence in sentences if sentence]
