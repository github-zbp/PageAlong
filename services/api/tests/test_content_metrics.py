from app.services.content_metrics import measure_text_content


def test_measure_text_content_counts_chinese_characters_and_english_words():
    chinese = measure_text_content("第一句，第二句。English words are ignored for the primary Chinese count.")
    english = measure_text_content("One short course note, with eight useful English words.")

    assert chinese.count == 6
    assert chinese.unit == "characters"
    assert chinese.estimated_reading_seconds >= 60

    assert english.count == 9
    assert english.unit == "words"
    assert english.estimated_reading_seconds >= 60
