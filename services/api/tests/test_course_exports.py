from app.models.course import ArticleText, AudioAsset, Course, CourseStatus, SourceType


def create_exportable_course(db_session):
    course = Course(
        user_id="test_user",
        title="可下载课程",
        source_type=SourceType.URL_IMPORT,
        status=CourseStatus.NEEDS_REVIEW,
    )
    db_session.add(course)
    db_session.flush()
    article_text = ArticleText(
        course_id=course.id,
        version=1,
        text="可下载课程\n\n第一句。第二句。",
        content_markdown="# 可下载课程\n\n第一句。第二句。",
    )
    db_session.add(article_text)
    db_session.commit()
    return course, article_text


def test_course_markdown_export_returns_attachment(client, db_session):
    course, _ = create_exportable_course(db_session)

    response = client.get(f"/courses/{course.id}/exports/markdown")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/markdown")
    assert "attachment" in response.headers["content-disposition"]
    assert ".md" in response.headers["content-disposition"]
    assert "# 可下载课程" in response.text
    assert "第一句。第二句。" in response.text


def test_course_word_and_pdf_exports_return_downloadable_files(client, db_session):
    course, _ = create_exportable_course(db_session)

    docx_response = client.get(f"/courses/{course.id}/exports/docx")
    pdf_response = client.get(f"/courses/{course.id}/exports/pdf")

    assert docx_response.status_code == 200
    assert docx_response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    assert docx_response.content[:2] == b"PK"
    assert ".docx" in docx_response.headers["content-disposition"]

    assert pdf_response.status_code == 200
    assert pdf_response.headers["content-type"].startswith("application/pdf")
    assert pdf_response.content.startswith(b"%PDF")
    assert ".pdf" in pdf_response.headers["content-disposition"]


def test_course_audio_download_returns_current_audio_attachment(client, db_session, tmp_path):
    course, article_text = create_exportable_course(db_session)
    audio_path = tmp_path / "course.wav"
    audio_path.write_bytes(b"RIFFaudio")
    audio_asset = AudioAsset(
        course_id=course.id,
        article_text_id=article_text.id,
        provider="fake",
        voice_id="fake-cn",
        format="wav",
        object_path=str(audio_path),
        content_type="audio/wav",
        duration_seconds=1,
        character_count=8,
        is_current=True,
    )
    db_session.add(audio_asset)
    db_session.flush()
    course.status = CourseStatus.READY
    course.current_audio_asset_id = audio_asset.id
    db_session.commit()

    response = client.get(f"/courses/{course.id}/audio-download")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("audio/wav")
    assert "attachment" in response.headers["content-disposition"]
    assert ".wav" in response.headers["content-disposition"]
    assert response.content == b"RIFFaudio"
