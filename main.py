import webview
from app.api import Api
from app.config import APP_TITLE, APP_WIDTH, APP_HEIGHT, resource_path
from app import database


def main():
    database.init_db()

    api = Api()
    window = webview.create_window(
        title=APP_TITLE,
        url=resource_path("ui/index.html"),
        js_api=api,
        width=APP_WIDTH,
        height=APP_HEIGHT,
        min_size=(800, 600),
        background_color="#0f0f0f",
    )
    webview.start(debug=False)


if __name__ == "__main__":
    main()
