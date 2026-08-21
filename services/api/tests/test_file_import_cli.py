from app.cli.import_file import import_file_item


def test_import_file_item_returns_service_payload(monkeypatch):
    monkeypatch.setattr(
        "app.cli.import_file.FileImportService",
        lambda db: type(
            "Service",
            (),
            {
                "process_item": lambda self, item_id: type(
                    "Result",
                    (),
                    {
                        "item_id": item_id,
                        "batch_id": "batch_1",
                        "course_id": "course_1",
                        "status": "succeeded",
                    },
                )()
            },
        )(),
    )

    assert import_file_item("item_1") == {
        "item_id": "item_1",
        "batch_id": "batch_1",
        "course_id": "course_1",
        "status": "succeeded",
    }
