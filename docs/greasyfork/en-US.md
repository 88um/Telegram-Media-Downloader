# Telegram Media Downloader

**Unlock Telegram: Download Anything You Like.**

This script unlocks and enables download of images, GIFs, and videos in Telegram webapps from chats, stories, and even private channels where downloading is disabled or restricted.

Important: This script is **FREE** to use. If you see anything asking you to pay to download, do not pay and report to [GitHub issues](https://github.com/Neet-Nestor/Telegram-Media-Downloader/issues) or the comments area to notify the developer.

## How to Install

Install a userscript extension and click the "install" button above to install the script.

**Important:** If you are using Tampermonkey extension in a Chrome-based browser, following [the instructions here](https://www.tampermonkey.net/faq.php#Q209) to enable Developer Mode.


## How to Use
This script only works on Telegram Webapp. It adds download controls for images, GIFs, videos, and supported audio.

### Download from the chat
Each supported visual media message in the active chat gets a **Download** button below the media on both WebA and WebK, plus a circular download shortcut on the media itself. Either control downloads the item without opening Telegram's media viewer.

For albums, every available item has a checkbox and is selected by default. Use **Download selected (N)** to download the checked items. If you clear every checkbox, the button is disabled and no download starts.

In-chat downloads are queued and run sequentially. If one item fails, the remaining queued items still continue. Your browser may ask you to allow **multiple downloads** for Telegram when downloading an album or several queued items; allow that permission for all selected files to be saved.

On WebA, a video that has not loaded and only shows the large play icon does not yet expose a usable URL. Start the video once, then use the in-chat download button. Already loaded videos and images are unaffected.

### Download from the media viewer or stories
The existing media-viewer, story, and WebK pinned-media download controls remain available. Single video and audio downloads continue to use the browser's save-file picker when supported; image downloads retain the existing direct browser download behavior.

![Image Download](https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExY2VjNmU2ZDM0YTFlOWY4YTMzZDZmNjVlMDE2ODQ4OGY4N2E3MDFkNSZlcD12MV9pbnRlcm5hbF9naWZzX2dpZklkJmN0PWc/lqCVcw0pCd2VA3zqoE/giphy.gif)
![GIF Download](https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExMzYwMzM3ZTMzYmI1MzA4M2EyYmY0NTFlOTg4OWFhNjhjNDk5YTkzYiZlcD12MV9pbnRlcm5hbF9naWZzX2dpZklkJmN0PWc/wnYzW4vwpPdeuo62nQ/giphy.gif)
![Video Download](https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExMXcxYnJxaXMxcW05YW5rZ2YzZzE0bTU4aTBwYXI1N3pmdnVzbDFrdSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/EEPbblwmSpteAmwLls/giphy.gif)
![Story Download](https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExZ3Z5Y2VzM2QzbW1xc3ZwNTQ2N3Q0a3lnanpxdW55c2Qzajl5NXZsaCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xJFjBGi8isHPR5cuHl/giphy.gif)

For videos, a progress bar appears in the bottom-right corner after the download starts. Images and audio do not show a progress bar.

### Supported Webapp Versions
There are 2 different versions of telegram webapps:
- https://webk.telegram.org / https://web.telegram.org/k/ (**Recommended**)
- https://webz.telegram.org / https://web.telegram.org/a/

This script should work on both versions of webapp, but some features are only available in the /k/ version (such as voice message downloads). If certain features are not working, switching to the /k/ version is recommended.

### Check Downloading Progress
A progress bar will show on the bottom-right of the screen for videos. You can also check [DevTools console](https://developer.chrome.com/docs/devtools/open/) for logs.

## Support Author
If you like this script, you can support me via [Venmo](https://venmo.com/u/NeetNestor) or [buy me a coffee](https://ko-fi.com/neetnestor) :)

## Contact
If you have any issue using this script, please reach out to our [GitHub page](https://github.com/Neet-Nestor/Telegram-Media-Downloader) and start an issue.