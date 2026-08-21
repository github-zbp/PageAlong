from app.services.sentence_service import split_into_sentences


def test_split_into_sentences_handles_chinese_and_english_punctuation():
    text = "第一句。第二句！Is this useful? 是的。"

    result = split_into_sentences(text)

    assert result == ["第一句。", "第二句！", "Is this useful?", "是的。"]


def test_split_into_sentences_removes_blank_lines():
    text = "第一段第一句。\n\n第二段第一句。"

    result = split_into_sentences(text)

    assert result == ["第一段第一句。", "第二段第一句。"]


def test_split_into_sentences_does_not_merge_heading_and_paragraph():
    text = "标题\n\n第一句。第二句。"

    result = split_into_sentences(text)

    assert result == ["标题", "第一句。", "第二句。"]
