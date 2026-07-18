// ==UserScript==
// @name         Telegram Media Downloader
// @name:en      Telegram Media Downloader
// @name:zh-CN   Telegram 受限图片视频下载器
// @name:zh-TW   Telegram 受限圖片影片下載器
// @name:ru      Telegram: загрузчик медиафайлов
// @version      1.213
// @namespace    https://github.com/Neet-Nestor/Telegram-Media-Downloader
// @description  Download images, GIFs, videos, and voice messages on the Telegram webapp from private channels that disable downloading and restrict saving content
// @description:en  Download images, GIFs, videos, and voice messages on the Telegram webapp from private channels that disable downloading and restrict saving content
// @description:ru Загружайте изображения, GIF-файлы, видео и голосовые сообщения в веб-приложении Telegram из частных каналов, которые отключили загрузку и ограничили сохранение контента
// @description:zh-CN 从禁止下载的Telegram频道中下载图片、视频及语音消息
// @description:zh-TW 從禁止下載的 Telegram 頻道中下載圖片、影片及語音訊息
// @author       Nestor Qin
// @license      GNU GPLv3
// @website      https://github.com/Neet-Nestor/Telegram-Media-Downloader
// @match        https://web.telegram.org/*
// @match        https://webk.telegram.org/*
// @match        https://webz.telegram.org/*
// @icon         https://img.icons8.com/color/452/telegram-app--v5.png
// ==/UserScript==


(function () {
  const logger = {
    info: (message, fileName = null) => {
      console.log(
        `[Tel Download] ${fileName ? `${fileName}: ` : ""}${message}`
      );
    },
    error: (message, fileName = null) => {
      console.error(
        `[Tel Download] ${fileName ? `${fileName}: ` : ""}${message}`
      );
    },
  };
  // Unicode values for icons (used in /k/ app)
  // https://github.com/morethanwords/tweb/blob/master/src/icons.ts
  const DOWNLOAD_ICON = "\ue979";
  const FORWARD_ICON = "\ue99a";
  const contentRangeRegex = /^bytes (\d+)-(\d+)\/(\d+)$/;
  const REFRESH_DELAY = 500;
  const hashCode = (s) => {
    var h = 0,
      l = s.length,
      i = 0;
    if (l > 0) {
      while (i < l) {
        h = ((h << 5) - h + s.charCodeAt(i++)) | 0;
      }
    }
    return h >>> 0;
  };

  const createProgressBar = (videoId, fileName) => {
    const html = document.documentElement;
    const isDarkMode =
      html?.classList.contains("night") ||
      html?.classList.contains("theme-dark");
    const container = document.getElementById(
      "tel-downloader-progress-bar-container"
    );
    if (!container || document.getElementById("tel-downloader-progress-" + videoId)) {
      return;
    }
    const innerContainer = document.createElement("div");
    innerContainer.id = "tel-downloader-progress-" + videoId;
    innerContainer.style.width = "20rem";
    innerContainer.style.marginTop = "0.4rem";
    innerContainer.style.padding = "0.6rem";
    innerContainer.style.backgroundColor = isDarkMode
      ? "rgba(0,0,0,0.3)"
      : "rgba(0,0,0,0.6)";

    const flexContainer = document.createElement("div");
    flexContainer.style.display = "flex";
    flexContainer.style.justifyContent = "space-between";

    const title = document.createElement("p");
    title.className = "filename";
    title.style.margin = 0;
    title.style.color = "white";
    title.innerText = fileName || "Downloading media";

    const closeButton = document.createElement("div");
    closeButton.style.cursor = "pointer";
    closeButton.style.fontSize = "1.2rem";
    closeButton.style.color = isDarkMode ? "#8a8a8a" : "white";
    closeButton.innerHTML = "&times;";
    closeButton.onclick = function () {
      if (innerContainer.parentNode === container) container.removeChild(innerContainer);
    };

    const progressBar = document.createElement("div");
    progressBar.className = "progress";
    progressBar.style.backgroundColor = "#e2e2e2";
    progressBar.style.position = "relative";
    progressBar.style.width = "100%";
    progressBar.style.height = "1.6rem";
    progressBar.style.borderRadius = "2rem";
    progressBar.style.overflow = "hidden";

    const counter = document.createElement("p");
    counter.style.position = "absolute";
    counter.style.zIndex = 5;
    counter.style.left = "50%";
    counter.style.top = "50%";
    counter.style.transform = "translate(-50%, -50%)";
    counter.style.margin = 0;
    counter.style.color = "black";
    const progress = document.createElement("div");
    progress.style.position = "absolute";
    progress.style.height = "100%";
    progress.style.width = "0%";
    progress.style.backgroundColor = "#6093B5";

    progressBar.appendChild(counter);
    progressBar.appendChild(progress);
    flexContainer.appendChild(title);
    flexContainer.appendChild(closeButton);
    innerContainer.appendChild(flexContainer);
    innerContainer.appendChild(progressBar);
    container.appendChild(innerContainer);
  };

  const updateProgress = (videoId, fileName, progress) => {
    const innerContainer = document.getElementById(
      "tel-downloader-progress-" + videoId
    );
    if (!innerContainer) return;
    const fileNameElement = innerContainer.querySelector("p.filename");
    const progressBar = innerContainer.querySelector("div.progress");
    if (!fileNameElement || !progressBar) return;
    fileNameElement.innerText = fileName;
    const counter = progressBar.querySelector("p");
    const fill = progressBar.querySelector("div");
    if (counter) counter.innerText = progress + "%";
    if (fill) fill.style.width = progress + "%";
  };

  const completeProgress = (videoId) => {
    const progressContainer = document.getElementById(
      "tel-downloader-progress-" + videoId
    );
    const progressBar = progressContainer?.querySelector("div.progress");
    if (!progressBar) return;
    const counter = progressBar.querySelector("p");
    const fill = progressBar.querySelector("div");
    if (counter) counter.innerText = "Completed";
    if (fill) {
      fill.style.backgroundColor = "#B6C649";
      fill.style.width = "100%";
    }
    window.setTimeout(() => progressContainer.remove(), 500);
  };

  const AbortProgress = (videoId) => {
    const progressBar = document
      .getElementById("tel-downloader-progress-" + videoId)
      ?.querySelector("div.progress");
    if (!progressBar) return;
    const counter = progressBar.querySelector("p");
    const fill = progressBar.querySelector("div");
    if (counter) counter.innerText = "Aborted";
    if (fill) {
      fill.style.backgroundColor = "#D16666";
      fill.style.width = "100%";
    }
  };

  const getPageWindow = () =>
    typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

  const sanitizeFileName = (fileName) =>
    String(fileName || "")
      .replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 180);

  const extensionForMime = (mimeType, fallback) => {
    const knownExtensions = {
      "audio/mpeg": "mp3",
      "audio/mp4": "m4a",
      "audio/ogg": "ogg",
      "image/gif": "gif",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "video/mp4": "mp4",
      "video/quicktime": "mov",
      "video/webm": "webm",
    };
    return knownExtensions[mimeType] || mimeType.split("/")[1] || fallback;
  };

  const replaceFileExtension = (fileName, extension) => {
    const safeName = sanitizeFileName(fileName) || "telegram-media";
    const lastDot = safeName.lastIndexOf(".");
    const baseName = lastDot > 0 ? safeName.substring(0, lastDot) : safeName;
    return `${baseName}.${extension}`;
  };

  const getDescriptorFileName = (url) => {
    try {
      const pathname = new URL(url, location.href).pathname;
      const encodedDescriptor = pathname.substring(pathname.lastIndexOf("/") + 1);
      const metadata = JSON.parse(decodeURIComponent(encodedDescriptor));
      return typeof metadata.fileName === "string" ? metadata.fileName : null;
    } catch {
      return null;
    }
  };

  const getUrlFileName = (url) => {
    try {
      const pathname = new URL(url, location.href).pathname;
      const candidate = decodeURIComponent(pathname.substring(pathname.lastIndexOf("/") + 1));
      return candidate.includes(".") ? candidate : null;
    } catch {
      return null;
    }
  };

  const isExpectedMime = (mimeType, mediaType) => {
    if (mediaType === "image") return mimeType.startsWith("image/");
    if (mediaType === "audio") {
      return mimeType.startsWith("audio/") || mimeType === "application/ogg";
    }
    return mimeType.startsWith("video/");
  };

  const supportsFileSystemAccess = () => {
    const pageWindow = getPageWindow();
    if (typeof pageWindow.showSaveFilePicker !== "function") return false;
    try {
      return pageWindow.self === pageWindow.top;
    } catch {
      return false;
    }
  };

  const triggerUrlDownload = (url, fileName) => {
    if (!document.body) throw new Error("Document body is not available");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const triggerBlobDownload = (blob, fileName) => {
    const blobUrl = window.URL.createObjectURL(blob);
    triggerUrlDownload(blobUrl, fileName);
    window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  };

  const downloadRangedMedia = async (url, options) => {
    const {
      mediaType,
      defaultExtension,
      fileName: requestedFileName,
      picker = true,
      showProgress = false,
    } = options;
    const downloadId =
      (Math.random() + 1).toString(36).substring(2, 10) +
      "_" +
      Date.now().toString();
    const safeUrl = typeof url === "string" ? url : "";
    let fileName = sanitizeFileName(
      requestedFileName ||
        getDescriptorFileName(safeUrl) ||
        getUrlFileName(safeUrl) ||
        `${hashCode(safeUrl).toString(36)}.${defaultExtension}`
    );
    if (!fileName.includes(".")) {
      fileName += `.${defaultExtension}`;
    }

    let writable = null;
    let mimeType = null;
    let totalSize = null;
    let nextOffset = 0;
    let downloadedSize = 0;
    const blobs = [];

    try {
      if (!url || typeof url !== "string") {
        throw new Error("Media URL is missing");
      }
      logger.info(`URL: ${url}`, fileName);

      if (picker && supportsFileSystemAccess()) {
        const handle = await getPageWindow().showSaveFilePicker({
          suggestedName: fileName,
        });
        writable = await handle.createWritable();
      }

      if (showProgress) createProgressBar(downloadId, fileName);

      while (true) {
        const response = await fetch(url, {
          method: "GET",
          headers: { Range: `bytes=${nextOffset}-` },
        });
        if (![200, 206].includes(response.status)) {
          throw new Error(
            "Non 200/206 response was received: " + response.status
          );
        }

        const responseMime = (response.headers.get("Content-Type") || "")
          .split(";")[0]
          .trim()
          .toLowerCase();
        if (!responseMime || !isExpectedMime(responseMime, mediaType)) {
          throw new Error(
            `Unexpected ${mediaType} response MIME type: ${responseMime || "missing"}`
          );
        }
        if (mimeType && responseMime !== mimeType) {
          throw new Error("Response MIME type changed during download");
        }
        if (!mimeType) {
          mimeType = responseMime;
          fileName = replaceFileExtension(
            fileName,
            extensionForMime(mimeType, defaultExtension)
          );
        }

        const contentRange = response.headers.get("Content-Range");
        const rangeMatch = contentRange?.match(contentRangeRegex) || null;
        let expectedChunkSize = null;
        let completeBody = false;

        if (rangeMatch) {
          const startOffset = parseInt(rangeMatch[1], 10);
          const endOffset = parseInt(rangeMatch[2], 10);
          const responseTotalSize = parseInt(rangeMatch[3], 10);
          if (
            !Number.isSafeInteger(startOffset) ||
            !Number.isSafeInteger(endOffset) ||
            !Number.isSafeInteger(responseTotalSize) ||
            startOffset !== nextOffset ||
            endOffset < startOffset ||
            endOffset >= responseTotalSize ||
            responseTotalSize <= 0
          ) {
            throw new Error(`Invalid Content-Range: ${contentRange}`);
          }
          if (totalSize !== null && totalSize !== responseTotalSize) {
            throw new Error("Total size changed during download");
          }
          totalSize = responseTotalSize;
          expectedChunkSize = endOffset - startOffset + 1;
          nextOffset = endOffset + 1;
        } else if (response.status === 200 && nextOffset === 0) {
          completeBody = true;
        } else {
          throw new Error(
            `Missing Content-Range for HTTP ${response.status} response`
          );
        }

        const responseBlob = await response.blob();
        if (responseBlob.size <= 0) {
          throw new Error("Received an empty media response");
        }
        if (
          expectedChunkSize !== null &&
          responseBlob.size !== expectedChunkSize
        ) {
          throw new Error(
            `Range body size mismatch: expected ${expectedChunkSize}, received ${responseBlob.size}`
          );
        }

        if (completeBody) {
          totalSize = responseBlob.size;
          nextOffset = responseBlob.size;
        }

        if (writable) {
          await writable.write(responseBlob);
        } else {
          blobs.push(responseBlob);
        }
        downloadedSize += responseBlob.size;

        logger.info(
          `Get response: ${responseBlob.size} bytes${
            contentRange ? ` from ${contentRange}` : " as complete body"
          }`,
          fileName
        );
        if (showProgress && totalSize) {
          const progress = Math.min(
            100,
            Math.round((nextOffset * 100) / totalSize)
          );
          updateProgress(downloadId, fileName, progress);
        }

        if (completeBody || (totalSize !== null && nextOffset >= totalSize)) {
          break;
        }
      }

      if (totalSize === null || downloadedSize !== totalSize) {
        throw new Error(
          `Downloaded size mismatch: expected ${totalSize}, received ${downloadedSize}`
        );
      }

      if (writable) {
        await writable.close();
        writable = null;
      } else {
        triggerBlobDownload(new Blob(blobs, { type: mimeType }), fileName);
      }

      if (showProgress) completeProgress(downloadId);
      logger.info("Download finished", fileName);
      return {
        ok: true,
        fileName,
        mimeType,
        size: downloadedSize,
      };
    } catch (error) {
      if (writable && typeof writable.abort === "function") {
        try {
          await writable.abort();
        } catch {
          // Ignore a secondary failure while cleaning up the file writer.
        }
      }
      if (showProgress) AbortProgress(downloadId);
      if (error?.name !== "AbortError") {
        logger.error(error instanceof Error ? error.message : error, fileName);
      }
      return {
        ok: false,
        cancelled: error?.name === "AbortError",
        error,
        fileName,
      };
    }
  };

  const tel_download_video = (url, options = {}) =>
    downloadRangedMedia(url, {
      mediaType: "video",
      defaultExtension: "mp4",
      picker: options.picker !== false,
      showProgress: true,
      fileName: options.fileName,
    });

  const tel_download_audio = (url, options = {}) =>
    downloadRangedMedia(url, {
      mediaType: "audio",
      defaultExtension: "ogg",
      picker: options.picker !== false,
      showProgress: false,
      fileName: options.fileName,
    });

  const tel_download_image = async (imageUrl, options = {}) => {
    const fallbackFileName = sanitizeFileName(
      options.fileName ||
        getUrlFileName(imageUrl) ||
        `${hashCode(imageUrl).toString(36)}.jpg`
    );
    if (options.picker !== false) {
      try {
        triggerUrlDownload(imageUrl, fallbackFileName);
        logger.info("Download triggered", fallbackFileName);
        return {
          ok: true,
          fileName: fallbackFileName,
          direct: true,
        };
      } catch (error) {
        logger.error(error instanceof Error ? error.message : error, fallbackFileName);
        return {
          ok: false,
          error,
          fileName: fallbackFileName,
        };
      }
    }

    const result = await downloadRangedMedia(imageUrl, {
      mediaType: "image",
      defaultExtension: "jpg",
      picker: false,
      showProgress: false,
      fileName: fallbackFileName,
    });
    if (result.ok || result.cancelled) return result;

    try {
      triggerUrlDownload(imageUrl, fallbackFileName);
      logger.info("Fetch failed; direct image download triggered", fallbackFileName);
      return {
        ok: true,
        fileName: fallbackFileName,
        direct: true,
      };
    } catch (error) {
      logger.error(error instanceof Error ? error.message : error, fallbackFileName);
      return {
        ok: false,
        error,
        fileName: fallbackFileName,
      };
    }
  };

  logger.info("Initialized");

  // For webz /a/ webapp
  setInterval(() => {
    // Stories
    const storiesContainer = document.getElementById("StoryViewer");
    if (storiesContainer) {
      console.log("storiesContainer");
      const createDownloadButton = () => {
        console.log("createDownloadButton");
        const downloadIcon = document.createElement("i");
        downloadIcon.className = "icon icon-download";
        const downloadButton = document.createElement("button");
        downloadButton.className =
          "Button TkphaPyQ tiny translucent-white round tel-download";
        downloadButton.appendChild(downloadIcon);
        downloadButton.setAttribute("type", "button");
        downloadButton.setAttribute("title", "Download");
        downloadButton.setAttribute("aria-label", "Download");
        downloadButton.onclick = () => {
          // 1. Story with video
          const video = storiesContainer.querySelector("video");
          const videoSrc =
            video?.src ||
            video?.currentSrc ||
            video?.querySelector("source")?.src;
          if (videoSrc) {
            tel_download_video(videoSrc);
          } else {
            // 2. Story with image
            const images = storiesContainer.querySelectorAll("img.PVZ8TOWS");
            if (images.length > 0) {
              const imageSrc = images[images.length - 1]?.src;
              if (imageSrc) tel_download_image(imageSrc);
            }
          }
        };
        return downloadButton;
      };

      const storyHeader =
        storiesContainer.querySelector(".GrsJNw3y") ||
        storiesContainer.querySelector(".DropdownMenu").parentNode;
      if (storyHeader && !storyHeader.querySelector(".tel-download")) {
        console.log("storyHeader");
        storyHeader.insertBefore(
          createDownloadButton(),
          storyHeader.querySelector("button")
        );
      }
    }

    // All media opened are located in .media-viewer-movers > .media-viewer-aspecter
    const mediaContainer = document.querySelector(
      "#MediaViewer .MediaViewerSlide--active"
    );
    const mediaViewerActions = document.querySelector(
      "#MediaViewer .MediaViewerActions"
    );
    if (!mediaContainer || !mediaViewerActions) return;

    // Videos in channels
    const videoPlayer = mediaContainer.querySelector(
      ".MediaViewerContent > .VideoPlayer"
    );
    const img = mediaContainer.querySelector(".MediaViewerContent > div > img");
    // 1. Video player detected - Video or GIF
    // container > .MediaViewerSlides > .MediaViewerSlide > .MediaViewerContent > .VideoPlayer > video[src]
    const downloadIcon = document.createElement("i");
    downloadIcon.className = "icon icon-download";
    const downloadButton = document.createElement("button");
    downloadButton.className =
      "Button smaller translucent-white round tel-download";
    downloadButton.setAttribute("type", "button");
    downloadButton.setAttribute("title", "Download");
    downloadButton.setAttribute("aria-label", "Download");
    if (videoPlayer) {
      const videoUrl = videoPlayer.querySelector("video").currentSrc;
      downloadButton.setAttribute("data-tel-download-url", videoUrl);
      downloadButton.appendChild(downloadIcon);
      downloadButton.onclick = () => {
        tel_download_video(videoPlayer.querySelector("video").currentSrc);
      };

      // Add download button to video controls
      const controls = videoPlayer.querySelector(".VideoPlayerControls");
      if (controls) {
        const buttons = controls.querySelector(".buttons");
        if (!buttons.querySelector("button.tel-download")) {
          const spacer = buttons.querySelector(".spacer");
          spacer.after(downloadButton);
        }
      }

      // Add/Update/Remove download button to topbar
      if (mediaViewerActions.querySelector("button.tel-download")) {
        const telDownloadButton = mediaViewerActions.querySelector(
          "button.tel-download"
        );
        if (
          mediaViewerActions.querySelectorAll('button[title="Download"]')
            .length > 1
        ) {
          // There's existing download button, remove ours
          mediaViewerActions.querySelector("button.tel-download").remove();
        } else if (
          telDownloadButton.getAttribute("data-tel-download-url") !== videoUrl
        ) {
          // Update existing button
          telDownloadButton.onclick = () => {
            tel_download_video(videoPlayer.querySelector("video").currentSrc);
          };
          telDownloadButton.setAttribute("data-tel-download-url", videoUrl);
        }
      } else if (
        !mediaViewerActions.querySelector('button[title="Download"]')
      ) {
        // Add the button if there's no download button at all
        mediaViewerActions.prepend(downloadButton);
      }
    } else if (img && img.src) {
      downloadButton.setAttribute("data-tel-download-url", img.src);
      downloadButton.appendChild(downloadIcon);
      downloadButton.onclick = () => {
        tel_download_image(img.src);
      };

      // Add/Update/Remove download button to topbar
      if (mediaViewerActions.querySelector("button.tel-download")) {
        const telDownloadButton = mediaViewerActions.querySelector(
          "button.tel-download"
        );
        if (
          mediaViewerActions.querySelectorAll('button[title="Download"]')
            .length > 1
        ) {
          // There's existing download button, remove ours
          mediaViewerActions.querySelector("button.tel-download").remove();
        } else if (
          telDownloadButton.getAttribute("data-tel-download-url") !== img.src
        ) {
          // Update existing button
          telDownloadButton.onclick = () => {
            tel_download_image(img.src);
          };
          telDownloadButton.setAttribute("data-tel-download-url", img.src);
        }
      } else if (
        !mediaViewerActions.querySelector('button[title="Download"]')
      ) {
        // Add the button if there's no download button at all
        mediaViewerActions.prepend(downloadButton);
      }
    }
  }, REFRESH_DELAY);

  // For webk /k/ webapp
  setInterval(() => {
    /* Voice Message or Circle Video */
    const pinnedAudio = document.body.querySelector(".pinned-audio");
    let dataMid;
    let downloadButtonPinnedAudio =
      document.body.querySelector("._tel_download_button_pinned_container") ||
      document.createElement("button");
    if (pinnedAudio) {
      dataMid = pinnedAudio.getAttribute("data-mid");
      downloadButtonPinnedAudio.className =
        "btn-icon tgico-download _tel_download_button_pinned_container";
      downloadButtonPinnedAudio.innerHTML = `<span class="tgico button-icon">${DOWNLOAD_ICON}</span>`;
    }
    const audioElements = document.body.querySelectorAll("audio-element");
    audioElements.forEach((audioElement) => {
      const bubble = audioElement.closest(".bubble");
      if (
        !bubble ||
        bubble.querySelector("._tel_download_button_pinned_container")
      ) {
        return; /* Skip if there's already a download button */
      }
      if (
        dataMid &&
        downloadButtonPinnedAudio.getAttribute("data-mid") !== dataMid &&
        audioElement.getAttribute("data-mid") === dataMid
      ) {
        downloadButtonPinnedAudio.onclick = (e) => {
          e.stopPropagation();
          if (isAudio) {
              tel_download_audio(link);
          } else {
              tel_download_video(link);
          }
        };
        downloadButtonPinnedAudio.setAttribute("data-mid", dataMid);
        const link = audioElement.audio && audioElement.audio.getAttribute("src");
        const isAudio = audioElement.audio && audioElement.audio instanceof HTMLAudioElement
        if (link) {
          pinnedAudio
            .querySelector(".pinned-container-wrapper-utils")
            .appendChild(downloadButtonPinnedAudio);
        }
      }
    });

    // Stories
    const storiesContainer = document.getElementById("stories-viewer");
    if (storiesContainer) {
      const createDownloadButton = () => {
        const downloadButton = document.createElement("button");
        downloadButton.className = "btn-icon rp tel-download";
        downloadButton.innerHTML = `<span class="tgico">${DOWNLOAD_ICON}</span><div class="c-ripple"></div>`;
        downloadButton.setAttribute("type", "button");
        downloadButton.setAttribute("title", "Download");
        downloadButton.setAttribute("aria-label", "Download");
        downloadButton.onclick = () => {
          // 1. Story with video
          const video = storiesContainer.querySelector("video.media-video");
          const videoSrc =
            video?.src ||
            video?.currentSrc ||
            video?.querySelector("source")?.src;
          if (videoSrc) {
            tel_download_video(videoSrc);
          } else {
            // 2. Story with image
            const imageSrc =
              storiesContainer.querySelector("img.media-photo")?.src;
            if (imageSrc) tel_download_image(imageSrc);
          }
        };
        return downloadButton;
      };

      const storyHeader = storiesContainer.querySelector(
        "[class^='_ViewerStoryHeaderRight']"
      );
      if (storyHeader && !storyHeader.querySelector(".tel-download")) {
        storyHeader.prepend(createDownloadButton());
      }

      const storyFooter = storiesContainer.querySelector(
        "[class^='_ViewerStoryFooterRight']"
      );
      if (storyFooter && !storyFooter.querySelector(".tel-download")) {
        storyFooter.prepend(createDownloadButton());
      }
    }

    // All media opened are located in .media-viewer-movers > .media-viewer-aspecter
    const mediaContainer = document.querySelector(".media-viewer-whole");
    if (!mediaContainer) return;
    const mediaAspecter = mediaContainer.querySelector(
      ".media-viewer-movers .media-viewer-aspecter"
    );
    const mediaButtons = mediaContainer.querySelector(
      ".media-viewer-topbar .media-viewer-buttons"
    );
    if (!mediaAspecter || !mediaButtons) return;

    // Query hidden buttons and unhide them
    const hiddenButtons = mediaButtons.querySelectorAll("button.btn-icon.hide");
    let onDownload = null;
    for (const btn of hiddenButtons) {
      btn.classList.remove("hide");
      if (btn.textContent === FORWARD_ICON) {
        btn.classList.add("tgico-forward");
      }
      if (btn.textContent === DOWNLOAD_ICON) {
        btn.classList.add("tgico-download");
        // Use official download buttons
        onDownload = () => {
          btn.click();
        };
        logger.info("onDownload", onDownload);
      }
    }

    if (mediaAspecter.querySelector(".ckin__player")) {
      // 1. Video player detected - Video and it has finished initial loading
      // container > .ckin__player > video[src]

      // add download button to videos
      const controls = mediaAspecter.querySelector(
        ".default__controls.ckin__controls"
      );
      if (controls && !controls.querySelector(".tel-download")) {
        const brControls = controls.querySelector(
          ".bottom-controls .right-controls"
        );
        const downloadButton = document.createElement("button");
        downloadButton.className =
          "btn-icon default__button tgico-download tel-download";
        downloadButton.innerHTML = `<span class="tgico">${DOWNLOAD_ICON}</span>`;
        downloadButton.setAttribute("type", "button");
        downloadButton.setAttribute("title", "Download");
        downloadButton.setAttribute("aria-label", "Download");
        if (onDownload) {
          downloadButton.onclick = onDownload;
        } else {
          downloadButton.onclick = () => {
            tel_download_video(mediaAspecter.querySelector("video").src);
          };
        }
        brControls.prepend(downloadButton);
      }
    } else if (
      mediaAspecter.querySelector("video") &&
      mediaAspecter.querySelector("video") &&
      !mediaButtons.querySelector("button.btn-icon.tgico-download")
    ) {
      // 2. Video HTML element detected, could be either GIF or unloaded video
      // container > video[src]
      const downloadButton = document.createElement("button");
      downloadButton.className = "btn-icon tgico-download tel-download";
      downloadButton.innerHTML = `<span class="tgico button-icon">${DOWNLOAD_ICON}</span>`;
      downloadButton.setAttribute("type", "button");
      downloadButton.setAttribute("title", "Download");
      downloadButton.setAttribute("aria-label", "Download");
      if (onDownload) {
        downloadButton.onclick = onDownload;
      } else {
        downloadButton.onclick = () => {
          tel_download_video(mediaAspecter.querySelector("video").src);
        };
      }
      mediaButtons.prepend(downloadButton);
    } else if (!mediaButtons.querySelector("button.btn-icon.tgico-download")) {
      // 3. Image without download button detected
      // container > img.thumbnail
      if (
        !mediaAspecter.querySelector("img.thumbnail") ||
        !mediaAspecter.querySelector("img.thumbnail").src
      ) {
        return;
      }
      const downloadButton = document.createElement("button");
      downloadButton.className = "btn-icon tgico-download tel-download";
      downloadButton.innerHTML = `<span class="tgico button-icon">${DOWNLOAD_ICON}</span>`;
      downloadButton.setAttribute("type", "button");
      downloadButton.setAttribute("title", "Download");
      downloadButton.setAttribute("aria-label", "Download");
      if (onDownload) {
        downloadButton.onclick = onDownload;
      } else {
        downloadButton.onclick = () => {
          tel_download_image(mediaAspecter.querySelector("img.thumbnail").src);
        };
      }
      mediaButtons.prepend(downloadButton);
    }
  }, REFRESH_DELAY);

  // In-chat media controls. This lifecycle is intentionally independent from the
  // existing viewer/story polling above so Telegram rerenders cannot disable it.
  const IN_CHAT_STYLE_ID = "tel-inchat-media-controls-style";
  const IN_CHAT_RECONCILE_DELAY = 120;
  const IN_CHAT_ROOT_DISCOVERY_DELAY = 2000;
  const MAX_ALBUM_SELECTIONS = 200;
  const inChatState = {
    root: null,
    chatKey: null,
    observer: null,
    resizeObserver: null,
    reconcileTimer: null,
    layoutFrame: null,
    layers: new Map(),
    changedHostPositions: new Map(),
    records: new Map(),
    albumViews: new Map(),
    albumSelections: new Map(),
    queuedResourceIds: new Set(),
    queue: Promise.resolve(),
  };

  const injectInChatStyles = () => {
    if (document.getElementById(IN_CHAT_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = IN_CHAT_STYLE_ID;
    style.textContent = `
      .tel-inchat-control-layer {
        position: absolute !important;
        inset: 0 !important;
        z-index: 40 !important;
        overflow: visible !important;
        pointer-events: none !important;
      }
      .tel-inchat-media-button,
      .tel-inchat-album-download,
      .tel-inchat-album-checkbox {
        box-sizing: border-box !important;
        font: 600 13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        pointer-events: auto !important;
        touch-action: manipulation !important;
      }
      .tel-inchat-media-button {
        position: absolute !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 36px !important;
        min-width: 36px !important;
        height: 36px !important;
        min-height: 36px !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 1px solid rgba(255, 255, 255, 0.82) !important;
        border-radius: 50% !important;
        color: #fff !important;
        background: rgba(35, 134, 214, 0.94) !important;
        box-shadow: 0 3px 12px rgba(0, 0, 0, 0.34) !important;
        cursor: pointer !important;
      }
      .tel-inchat-media-button:hover,
      .tel-inchat-album-download:hover {
        background: rgba(48, 158, 242, 0.98) !important;
      }
      .tel-inchat-media-button:focus-visible,
      .tel-inchat-album-download:focus-visible,
      .tel-inchat-album-checkbox:focus-visible {
        outline: 3px solid #fff !important;
        outline-offset: 2px !important;
      }
      .tel-inchat-media-button:disabled {
        cursor: wait !important;
        opacity: 0.74 !important;
      }
      .tel-inchat-download-glyph {
        width: 18px !important;
        height: 18px !important;
        pointer-events: none !important;
      }
      .tel-inchat-album-checkbox {
        appearance: none !important;
        position: absolute !important;
        width: 24px !important;
        min-width: 24px !important;
        height: 24px !important;
        min-height: 24px !important;
        margin: 0 !important;
        border: 2px solid #fff !important;
        border-radius: 6px !important;
        background: rgba(20, 28, 36, 0.68) !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
        cursor: pointer !important;
      }
      .tel-inchat-album-checkbox:checked {
        border-color: #fff !important;
        background-color: #2386d6 !important;
        background-image: linear-gradient(135deg, transparent 43%, #fff 43%, #fff 51%, transparent 51%), linear-gradient(45deg, transparent 48%, #fff 48%, #fff 57%, transparent 57%) !important;
        background-position: 8px 1px, 3px 8px !important;
        background-size: 10px 16px, 8px 9px !important;
        background-repeat: no-repeat !important;
      }
      .tel-inchat-message-actions {
        position: relative !important;
        z-index: 41 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        width: 100% !important;
        margin-top: 8px !important;
        pointer-events: auto !important;
      }
      .tel-inchat-album-download {
        position: static !important;
        min-height: 34px !important;
        margin: 0 !important;
        padding: 8px 12px !important;
        border: 1px solid rgba(255, 255, 255, 0.76) !important;
        border-radius: 9px !important;
        color: #fff !important;
        background: rgba(35, 134, 214, 0.94) !important;
        box-shadow: 0 3px 12px rgba(0, 0, 0, 0.3) !important;
        cursor: pointer !important;
        white-space: nowrap !important;
      }
      .tel-inchat-album-download:disabled {
        cursor: not-allowed !important;
        opacity: 0.58 !important;
      }
      @media (prefers-reduced-motion: reduce) {
        .tel-inchat-media-button,
        .tel-inchat-album-download,
        .tel-inchat-album-checkbox { transition: none !important; }
      }
    `;
    (document.head || document.documentElement)?.appendChild(style);
  };

  const isVisibleElement = (element) => {
    if (!(element instanceof HTMLElement) || !element.isConnected) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  };

  const detectWebApp = () => {
    if (
      location.pathname.startsWith("/a/") ||
      location.hostname === "webz.telegram.org"
    ) {
      return "a";
    }
    if (
      location.pathname.startsWith("/k/") ||
      location.hostname === "webk.telegram.org"
    ) {
      return "k";
    }
    return null;
  };

  const findActiveChatRoot = () => {
    const webApp = detectWebApp();
    if (webApp === "k") {
      return (
        Array.from(document.querySelectorAll(".chat.tabs-tab.active")).find(
          (candidate) =>
            isVisibleElement(candidate) &&
            candidate.querySelector(".bubble[data-mid][data-peer-id]")
        ) || null
      );
    }
    if (webApp !== "a") return null;

    const candidates = Array.from(
      document.querySelectorAll(
        [
          "#MiddleColumn .Transition_slide-active .messages-container",
          "#MiddleColumn .Transition_slide-active .MessageList",
          "#MiddleColumn .Transition_slide-to .messages-container",
          "#MiddleColumn .Transition_slide-to .MessageList",
          "#MiddleColumn .messages-container",
          "#MiddleColumn .MessageList",
          "#Main .messages-container",
          "#Main .MessageList",
        ].join(", ")
      )
    ).filter(
      (candidate) =>
        isVisibleElement(candidate) &&
        !candidate.closest("#MediaViewer, #StoryViewer") &&
        candidate.querySelector(".Message[data-message-id]")
    );
    candidates.sort((left, right) => {
      if (left.contains(right)) return 1;
      if (right.contains(left)) return -1;
      return (
        right.querySelectorAll(".Message[data-message-id]").length -
        left.querySelectorAll(".Message[data-message-id]").length
      );
    });
    if (candidates[0]) return candidates[0];

    const visibleMessage = Array.from(
      document.querySelectorAll("#MiddleColumn .Message[data-message-id]")
    ).find(isVisibleElement);
    return (
      visibleMessage?.closest(
        ".messages-container, .MessageList, .Transition_slide-active, .Transition_slide-to"
      ) || null
    );
  };

  const getChatKey = (root) => {
    const webApp = detectWebApp() || "unknown";
    const route = `${location.pathname}${location.hash}`;
    const peer =
      root?.querySelector(".bubble[data-peer-id]")?.getAttribute("data-peer-id") ||
      route ||
      "unknown";
    return `${webApp}:${peer}`;
  };

  const getUsableMediaUrl = (element) => {
    if (!element) return null;
    const candidate =
      element.currentSrc ||
      element.src ||
      element.querySelector?.("source[src]")?.src ||
      null;
    if (!candidate || candidate === location.href || candidate.startsWith("data:")) {
      return null;
    }
    try {
      const parsed = new URL(candidate, location.href);
      return ["blob:", "http:", "https:"].includes(parsed.protocol)
        ? parsed.href
        : null;
    } catch {
      return null;
    }
  };

  const makeResourceId = (webApp, chatKey, messageId, resourceKey) =>
    ["tel", webApp, chatKey, messageId, resourceKey]
      .map((value) => encodeURIComponent(String(value)))
      .join(":");

  const makeInChatFileName = (messageId, index, kind, suppliedName) => {
    if (suppliedName) return sanitizeFileName(suppliedName);
    const extension = kind === "image" ? "jpg" : kind === "audio" ? "ogg" : "mp4";
    return sanitizeFileName(`telegram_${messageId}_${index + 1}.${extension}`);
  };

  const getWebKChatManager = () => {
    const pageWindow = getPageWindow();
    const chat = pageWindow?.appImManager?.chat || pageWindow?.chat;
    return chat && typeof chat.getMessage === "function" ? chat : null;
  };

  const getDocumentAttribute = (documentObject, predicate) =>
    (Array.isArray(documentObject?.attributes) ? documentObject.attributes : []).find(
      predicate
    );

  const isDocumentAttribute = (attribute, name) =>
    attribute?._ === name || attribute?.className === name;

  const getDocumentFileName = (documentObject) => {
    const fileAttribute = getDocumentAttribute(documentObject, (attribute) =>
      isDocumentAttribute(attribute, "documentAttributeFilename")
    );
    return (
      documentObject?.file_name ||
      documentObject?.fileName ||
      fileAttribute?.file_name ||
      fileAttribute?.fileName ||
      null
    );
  };

  const normalizeWebKDocument = (documentObject) => {
    if (!documentObject || typeof documentObject !== "object") return null;
    const mimeType = String(
      documentObject.mime_type || documentObject.mimeType || ""
    ).toLowerCase();
    const isAnimated = getDocumentAttribute(
      documentObject,
      (attribute) =>
        isDocumentAttribute(attribute, "documentAttributeAnimated") ||
        attribute?.animated === true
    );
    if (!mimeType.startsWith("video/") && !(mimeType === "image/gif" && isAnimated)) {
      return null;
    }

    const idValue = documentObject.id;
    const accessHashValue =
      documentObject.access_hash ?? documentObject.accessHash;
    const fileReference =
      documentObject.file_reference ?? documentObject.fileReference;
    const dcId = Number(documentObject.dc_id ?? documentObject.dcId);
    const size = Number(documentObject.size);
    const id = idValue == null ? "" : String(idValue);
    const accessHash =
      accessHashValue == null ? "" : String(accessHashValue);
    const hasFileReference =
      (typeof fileReference === "string" && fileReference.length > 0) ||
      (Array.isArray(fileReference) && fileReference.length > 0) ||
      (ArrayBuffer.isView(fileReference) && fileReference.byteLength > 0) ||
      (fileReference &&
        typeof fileReference === "object" &&
        Object.keys(fileReference).length > 0);
    if (
      !id ||
      !accessHash ||
      id === "[object Object]" ||
      accessHash === "[object Object]" ||
      !hasFileReference ||
      !Number.isSafeInteger(dcId) ||
      dcId <= 0 ||
      !Number.isFinite(size) ||
      size <= 0
    ) {
      return null;
    }

    const descriptor = {
      dcId,
      location: {
        _: "inputDocumentFileLocation",
        id,
        access_hash: accessHash,
        file_reference: fileReference,
      },
      size,
      mimeType,
      fileName: getDocumentFileName(documentObject) || undefined,
    };
    try {
      const streamPath = location.pathname.startsWith("/k/")
        ? "/k/stream/"
        : "/stream/";
      const streamBase = new URL(streamPath, location.origin).href;
      return {
        url: `${streamBase}${encodeURIComponent(JSON.stringify(descriptor))}`,
        kind: mimeType.startsWith("image/") ? "image" : "video",
        mimeType,
        fileName: descriptor.fileName,
        size,
      };
    } catch {
      return null;
    }
  };

  const resolveWebKInternalResource = (peerId, messageId) => {
    const chat = getWebKChatManager();
    if (!chat || !peerId || !messageId) return null;
    try {
      const message = chat.getMessage(`${peerId}_${messageId}`);
      const media = message?.media;
      if (media?._ !== "messageMediaDocument" || !media.document) return null;
      const documents = [media.document]
        .concat(Array.isArray(media.alt_documents) ? media.alt_documents : [])
        .map(normalizeWebKDocument)
        .filter(Boolean);
      if (!documents.length) return null;
      documents.sort((left, right) => (right.size || 0) - (left.size || 0));
      return documents[0];
    } catch (error) {
      logger.info(
        `WebK metadata lookup skipped: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  };

  const collectWebAResources = (root, chatKey) => {
    const messages = [];
    root.querySelectorAll(".Message[data-message-id]").forEach((message) => {
      const messageId = message.getAttribute("data-message-id");
      if (!messageId) return;
      const albumSurfaces = Array.from(
        message.querySelectorAll(".Album .media-inner")
      );
      const isAlbum = albumSurfaces.length > 0;
      const unloadedMessageVideo = message.querySelector("video.full-media");
      if (
        !isAlbum &&
        unloadedMessageVideo &&
        !getUsableMediaUrl(unloadedMessageVideo)
      ) {
        return;
      }
      const singleMedia =
        message.querySelector("video.full-media") ||
        message.querySelector("img.full-media");
      const surfaces = isAlbum
        ? albumSurfaces
        : singleMedia
        ? [singleMedia]
        : [];
      const resources = [];
      const seenSurfaces = new Set();

      surfaces.forEach((surface, index) => {
        const mediaSurface = isAlbum ? surface : surface;
        if (seenSurfaces.has(mediaSurface)) return;
        seenSurfaces.add(mediaSurface);
        const video = mediaSurface.matches?.("video")
          ? mediaSurface
          : mediaSurface.querySelector?.("video.full-media, video");
        const image = mediaSurface.matches?.("img")
          ? mediaSurface
          : mediaSurface.querySelector?.("img.full-media, img");
        const videoUrl = getUsableMediaUrl(video);
        const mediaWrapper =
          mediaSurface.closest?.(".album-item-select-wrapper") || mediaSurface;
        if (
          video &&
          !videoUrl
        ) {
          return;
        }
        if (
          !videoUrl &&
          mediaWrapper.querySelector?.(".icon-large-play")
        ) {
          return;
        }
        const kind = videoUrl ? "video" : "image";
        const url = videoUrl || getUsableMediaUrl(image);
        if (!url) return;
        const albumIdMatch = mediaSurface.id?.match(
          /album-media-message-(-?\d+)(?:-(\d+))?$/
        );
        const resourceMessageId = albumIdMatch?.[1] || messageId;
        const resourceKey =
          mediaSurface.id || `${resourceMessageId}:${index}:${kind}`;
        resources.push({
          id: makeResourceId("a", chatKey, resourceMessageId, resourceKey),
          messageId: resourceMessageId,
          index,
          kind,
          url,
          surface: mediaSurface,
          fileName: makeInChatFileName(resourceMessageId, index, kind),
        });
      });

      if (!resources.length) return;
      messages.push({
        key: `${chatKey}:${messageId}`,
        messageId,
        host:
          message.querySelector(".message-content") ||
          message.querySelector(".Message-content") ||
          message,
        isAlbum,
        resources,
      });
    });
    return messages;
  };

  const collectWebKSurfaceMedia = (surface) => {
    const elements = surface.matches?.("video, img")
      ? [surface]
      : Array.from(surface.querySelectorAll("video, img"));
    const video = elements.find((element) => element instanceof HTMLVideoElement);
    const videoUrl = getUsableMediaUrl(video);
    if (videoUrl) return { kind: "video", url: videoUrl };
    if (video) return { needsInternalResolution: true };
    const image = elements.find(
      (element) =>
        element instanceof HTMLImageElement &&
        (element.matches(".media-photo, .full-media") ||
          element.closest(".album-item.grouped-item")) &&
        getUsableMediaUrl(element)
    );
    const imageUrl = getUsableMediaUrl(image);
    return imageUrl ? { kind: "image", url: imageUrl } : null;
  };

  const collectWebKResources = (root, chatKey) => {
    const messages = [];
    root.querySelectorAll(".bubble[data-mid][data-peer-id]").forEach((bubble) => {
      const messageId = bubble.getAttribute("data-mid");
      const peerId = bubble.getAttribute("data-peer-id");
      if (!messageId || !peerId) return;
      const albumSurfaces = Array.from(
        bubble.querySelectorAll(".album-item.grouped-item")
      );
      const isAlbum = albumSurfaces.length > 0;
      let surfaces = albumSurfaces;
      if (!isAlbum) {
        const content =
          bubble.querySelector(".bubble-content-wrapper > .bubble-content") ||
          bubble.querySelector(".bubble-content");
        if (!content) return;
        const directAttachments = Array.from(content.children).filter(
          (element) =>
            element.matches(
              ".attachment, .media-container, .media, .document-container"
            ) &&
            element.querySelector(
              "video, img.media-photo, img.full-media"
            )
        );
        if (directAttachments.length) {
          surfaces = directAttachments;
        } else {
          surfaces = Array.from(
            content.querySelectorAll(
              ":scope > video, :scope > img.media-photo, :scope > img.full-media"
            )
          );
        }
      }
      const resources = [];

      surfaces.forEach((surface, index) => {
        const scopedNode =
          surface.closest("[data-mid][data-peer-id]") || bubble;
        const resourceMessageId = scopedNode.getAttribute("data-mid") || messageId;
        const resourcePeerId = scopedNode.getAttribute("data-peer-id") || peerId;
        const domMedia = collectWebKSurfaceMedia(surface);
        const prefersInternal = Boolean(
          surface.matches?.(".document, .document-container, [data-doc-id]") ||
            surface.querySelector?.(
              "video, button.video-play, .media-video, .media-round, .media-gif-wrapper, [data-doc-id]"
            )
        );
        const shouldResolveInternal =
          prefersInternal ||
          !domMedia ||
          domMedia.needsInternalResolution ||
          (domMedia.kind === "video" && domMedia.url?.startsWith("blob:"));
        const internalMedia = shouldResolveInternal
          ? resolveWebKInternalResource(resourcePeerId, resourceMessageId)
          : null;
        const media =
          prefersInternal && internalMedia?.url
            ? internalMedia
            : domMedia?.url
            ? domMedia
            : internalMedia;
        const fallbackMedia =
          media === internalMedia && domMedia?.url
            ? domMedia
            : media === domMedia && internalMedia?.url
            ? internalMedia
            : null;
        if (!media?.url) return;
        const resourceKey = `${resourcePeerId}_${resourceMessageId}`;
        resources.push({
          id: makeResourceId("k", chatKey, resourceMessageId, resourceKey),
          messageId: resourceMessageId,
          index,
          kind: media.kind,
          url: media.url,
          surface,
          fileName: makeInChatFileName(
            resourceMessageId,
            index,
            media.kind,
            media.fileName
          ),
          fallback: fallbackMedia?.url
            ? {
                kind: fallbackMedia.kind,
                url: fallbackMedia.url,
                fileName: makeInChatFileName(
                  resourceMessageId,
                  index,
                  fallbackMedia.kind,
                  fallbackMedia.fileName
                ),
              }
            : null,
        });
      });

      if (!resources.length) return;
      messages.push({
        key: `${chatKey}:${peerId}:${messageId}`,
        messageId,
        host: bubble.querySelector(".bubble-content") || bubble,
        isAlbum,
        resources,
      });
    });
    return messages;
  };

  const stopMediaViewerEvent = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  const createDownloadGlyph = () => {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("tel-inchat-download-glyph");
    const path = document.createElementNS(namespace, "path");
    path.setAttribute(
      "d",
      "M12 3v11m0 0 4-4m-4 4-4-4M5 19h14"
    );
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    return svg;
  };

  const ensureControlLayer = (host) => {
    const existing = inChatState.layers.get(host);
    if (existing?.isConnected) return existing;
    if (!(host instanceof HTMLElement)) return null;
    if (window.getComputedStyle(host).position === "static") {
      inChatState.changedHostPositions.set(host, host.style.position);
      host.style.position = "relative";
    }
    const layer = document.createElement("div");
    layer.className = "tel-inchat-control-layer";
    layer.setAttribute("aria-hidden", "false");
    host.appendChild(layer);
    inChatState.layers.set(host, layer);
    return layer;
  };

  const setResourceBusy = (resourceId, isBusy) => {
    const record = inChatState.records.get(resourceId);
    if (!record?.button) return;
    record.button.disabled = isBusy;
    record.button.setAttribute("aria-busy", String(isBusy));
    record.button.title = isBusy ? "Download queued" : "Download media";
  };

  const downloadQueuedResource = (resource) => {
    const options = { picker: false, fileName: resource.fileName };
    if (resource.kind === "image") {
      return tel_download_image(resource.url, options);
    }
    if (resource.kind === "audio") {
      return tel_download_audio(resource.url, options);
    }
    return tel_download_video(resource.url, options);
  };

  const runQueuedResource = async (resource) => {
    let result = await downloadQueuedResource(resource);
    if (!result.ok && !result.cancelled && resource.fallback) {
      logger.info("DOM media URL failed; trying WebK metadata URL", resource.fileName);
      result = await downloadQueuedResource(resource.fallback);
    }
    if (!result.ok && !result.cancelled) {
      throw result.error || new Error(`Failed to download ${resource.fileName}`);
    }
  };

  const enqueueResources = (resources) => {
    resources.forEach((resource) => {
      if (!resource || inChatState.queuedResourceIds.has(resource.id)) return;
      const queuedResource = {
        id: resource.id,
        kind: resource.kind,
        url: resource.url,
        fileName: resource.fileName,
        fallback: resource.fallback
          ? {
              kind: resource.fallback.kind,
              url: resource.fallback.url,
              fileName: resource.fallback.fileName,
            }
          : null,
      };
      inChatState.queuedResourceIds.add(queuedResource.id);
      setResourceBusy(queuedResource.id, true);
      refreshMessageViewsForResource(queuedResource.id);
      inChatState.queue = inChatState.queue.then(async () => {
        try {
          await runQueuedResource(queuedResource);
        } catch (error) {
          logger.error(
            error instanceof Error ? error.message : error,
            queuedResource.fileName
          );
        } finally {
          inChatState.queuedResourceIds.delete(queuedResource.id);
          setResourceBusy(queuedResource.id, false);
          refreshMessageViewsForResource(queuedResource.id);
        }
      });
    });
    return inChatState.queue;
  };

  const refreshMessageView = (messageKey) => {
    const view = inChatState.albumViews.get(messageKey);
    if (!view) return;
    const selection = inChatState.albumSelections.get(messageKey) || new Map();
    const selectedResources = view.isAlbum
      ? view.resources.filter((resource) => selection.get(resource.id) !== false)
      : view.resources;
    const queuedCount = selectedResources.filter((resource) =>
      inChatState.queuedResourceIds.has(resource.id)
    ).length;

    view.checkboxes.forEach((checkbox, resourceId) => {
      const checked = selection.get(resourceId) !== false;
      checkbox.checked = checked;
      checkbox.setAttribute("aria-checked", String(checked));
    });

    if (queuedCount > 0) {
      view.downloadButton.textContent = `Downloading (${queuedCount}/${selectedResources.length})`;
    } else if (view.isAlbum) {
      view.downloadButton.textContent = `Download selected (${selectedResources.length})`;
    } else {
      view.downloadButton.textContent = "Download";
    }
    view.downloadButton.disabled =
      selectedResources.length === 0 || queuedCount > 0;
    const label = view.isAlbum
      ? `Download ${selectedResources.length} selected album media item${
          selectedResources.length === 1 ? "" : "s"
        }`
      : "Download this media message";
    view.downloadButton.setAttribute("aria-label", label);
    view.downloadButton.title = label;
  };

  const refreshMessageViewsForResource = (resourceId) => {
    inChatState.albumViews.forEach((view, messageKey) => {
      if (view.resources.some((resource) => resource.id === resourceId)) {
        refreshMessageView(messageKey);
      }
    });
  };

  const renderMessageControls = (message) => {
    const layer = ensureControlLayer(message.host);
    if (!layer) return;
    let selection = null;
    if (message.isAlbum) {
      selection = inChatState.albumSelections.get(message.key) || new Map();
      inChatState.albumSelections.set(message.key, selection);
    }
    const checkboxes = new Map();

    message.resources.forEach((resource) => {
      if (selection && !selection.has(resource.id)) {
        selection.set(resource.id, true);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tel-inchat-media-button";
      button.title = "Download media";
      button.setAttribute("aria-label", "Download this media item");
      button.appendChild(createDownloadGlyph());
      ["pointerdown", "mousedown", "dblclick"].forEach((eventName) =>
        button.addEventListener(eventName, stopMediaViewerEvent)
      );
      button.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") event.stopPropagation();
      });
      button.addEventListener("click", (event) => {
        stopMediaViewerEvent(event);
        enqueueResources([resource]);
      });
      layer.appendChild(button);

      let checkbox = null;
      if (message.isAlbum) {
        checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "tel-inchat-album-checkbox";
        checkbox.checked = selection.get(resource.id) !== false;
        checkbox.title = "Select this album media item";
        checkbox.setAttribute("aria-label", "Select this album media item");
        checkbox.setAttribute("aria-checked", String(checkbox.checked));
        ["pointerdown", "mousedown", "dblclick"].forEach((eventName) =>
          checkbox.addEventListener(eventName, (event) => event.stopPropagation())
        );
        checkbox.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            checkbox.click();
          } else if (event.key === " ") {
            event.stopPropagation();
          }
        });
        checkbox.addEventListener("click", (event) => {
          event.stopPropagation();
          selection.set(resource.id, checkbox.checked);
          refreshMessageView(message.key);
        });
        layer.appendChild(checkbox);
        checkboxes.set(resource.id, checkbox);
      }

      inChatState.records.set(resource.id, {
        resource,
        host: message.host,
        surface: resource.surface,
        button,
        checkbox,
        isAlbum: message.isAlbum,
      });
      setResourceBusy(
        resource.id,
        inChatState.queuedResourceIds.has(resource.id)
      );
    });

    const actionContainer = document.createElement("div");
    actionContainer.className = "tel-inchat-message-actions";
    const downloadButton = document.createElement("button");
    downloadButton.type = "button";
    downloadButton.className = "tel-inchat-album-download";
    ["pointerdown", "mousedown", "dblclick"].forEach((eventName) =>
      downloadButton.addEventListener(eventName, stopMediaViewerEvent)
    );
    downloadButton.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") event.stopPropagation();
    });
    downloadButton.addEventListener("click", (event) => {
      stopMediaViewerEvent(event);
      const currentSelection =
        inChatState.albumSelections.get(message.key) || new Map();
      const selected = message.isAlbum
        ? message.resources.filter(
            (resource) => currentSelection.get(resource.id) !== false
          )
        : message.resources.slice(0, 1);
      if (selected.length) enqueueResources(selected);
    });
    actionContainer.appendChild(downloadButton);
    message.host.appendChild(actionContainer);
    inChatState.albumViews.set(message.key, {
      host: message.host,
      isAlbum: message.isAlbum,
      resources: message.resources,
      checkboxes,
      actionContainer,
      downloadButton,
    });
    refreshMessageView(message.key);
  };

  const positionInChatControls = () => {
    inChatState.layoutFrame = null;
    inChatState.records.forEach((record) => {
      const { host, surface, button, checkbox, isAlbum } = record;
      if (!host.isConnected || !surface.isConnected) return;
      const hostRect = host.getBoundingClientRect();
      const surfaceRect = surface.getBoundingClientRect();
      if (
        hostRect.width <= 0 ||
        hostRect.height <= 0 ||
        surfaceRect.width <= 0 ||
        surfaceRect.height <= 0
      ) {
        button.style.display = "none";
        if (checkbox) checkbox.style.display = "none";
        return;
      }
      button.style.display = "inline-flex";
      if (checkbox) checkbox.style.display = "block";
      const scaleX = host.offsetWidth > 0 ? hostRect.width / host.offsetWidth : 1;
      const scaleY = host.offsetHeight > 0 ? hostRect.height / host.offsetHeight : 1;
      const right = (surfaceRect.right - hostRect.left) / scaleX + host.scrollLeft;
      const bottom = (surfaceRect.bottom - hostRect.top) / scaleY + host.scrollTop;
      button.style.left = `${Math.max(0, right - 44)}px`;
      button.style.top = `${Math.max(0, bottom - (isAlbum ? 76 : 44))}px`;
      if (checkbox) {
        checkbox.style.left = `${Math.max(0, right - 32)}px`;
        checkbox.style.top = `${Math.max(0, bottom - 32)}px`;
      }
    });

  };

  const scheduleInChatLayout = () => {
    if (inChatState.layoutFrame !== null) return;
    inChatState.layoutFrame = window.requestAnimationFrame(positionInChatControls);
  };

  const cleanupInChatControls = () => {
    if (inChatState.layoutFrame !== null) {
      window.cancelAnimationFrame(inChatState.layoutFrame);
      inChatState.layoutFrame = null;
    }
    inChatState.resizeObserver?.disconnect();
    inChatState.resizeObserver = null;
    inChatState.albumViews.forEach((view) => view.actionContainer?.remove());
    inChatState.layers.forEach((layer) => layer.remove());
    inChatState.layers.clear();
    inChatState.changedHostPositions.forEach((position, host) => {
      if (host.isConnected && host.style.position === "relative") {
        host.style.position = position;
      }
    });
    inChatState.changedHostPositions.clear();
    inChatState.records.clear();
    inChatState.albumViews.clear();
  };

  const observeInChatLayout = () => {
    if (typeof ResizeObserver !== "function") return;
    inChatState.resizeObserver = new ResizeObserver(scheduleInChatLayout);
    inChatState.layers.forEach((layer, host) => {
      inChatState.resizeObserver.observe(host);
    });
    inChatState.records.forEach((record) => {
      inChatState.resizeObserver.observe(record.surface);
    });
  };

  const isInChatControlNode = (node) => {
    const element = node instanceof Element ? node : node?.parentElement;
    return Boolean(
      element?.closest(
        ".tel-inchat-control-layer, .tel-inchat-message-actions"
      )
    );
  };

  const observeActiveRoot = () => {
    inChatState.observer?.disconnect();
    if (!inChatState.root?.isConnected) return;
    inChatState.observer = new MutationObserver((records) => {
      if (records.some((record) => !isInChatControlNode(record.target))) {
        scheduleInChatReconcile();
      }
    });
    inChatState.observer.observe(inChatState.root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "src",
        "data-mid",
        "data-peer-id",
        "data-message-id",
      ],
    });
  };

  const pruneAlbumSelections = (messages) => {
    if (inChatState.albumSelections.size <= MAX_ALBUM_SELECTIONS) return;
    const visibleAlbumKeys = new Set(
      messages.filter((message) => message.isAlbum).map((message) => message.key)
    );
    for (const messageKey of inChatState.albumSelections.keys()) {
      if (inChatState.albumSelections.size <= MAX_ALBUM_SELECTIONS) break;
      if (!visibleAlbumKeys.has(messageKey)) {
        inChatState.albumSelections.delete(messageKey);
      }
    }
  };

  const hasSameInChatResources = (messages) => {
    const resources = messages.flatMap((message) => message.resources);
    if (
      resources.length !== inChatState.records.size ||
      messages.length !== inChatState.albumViews.size
    ) {
      return false;
    }

    for (const message of messages) {
      const view = inChatState.albumViews.get(message.key);
      if (
        !view ||
        view.host !== message.host ||
        view.isAlbum !== message.isAlbum ||
        !view.actionContainer?.isConnected ||
        !view.downloadButton?.isConnected ||
        !inChatState.layers.get(message.host)?.isConnected ||
        view.resources.length !== message.resources.length
      ) {
        return false;
      }
      for (const resource of message.resources) {
        const record = inChatState.records.get(resource.id);
        if (
          !record ||
          record.host !== message.host ||
          record.surface !== resource.surface ||
          !record.button?.isConnected ||
          (message.isAlbum && !record.checkbox?.isConnected) ||
          record.resource.url !== resource.url ||
          record.resource.fileName !== resource.fileName ||
          record.resource.fallback?.url !== resource.fallback?.url
        ) {
          return false;
        }
      }
    }
    return true;
  };

  const reconcileInChatControls = () => {
    const root = inChatState.root;
    if (!root?.isConnected) {
      cleanupInChatControls();
      return;
    }
    inChatState.observer?.disconnect();
    try {
      const webApp = detectWebApp();
      const messages =
        webApp === "a"
          ? collectWebAResources(root, inChatState.chatKey)
          : webApp === "k"
          ? collectWebKResources(root, inChatState.chatKey)
          : [];
      pruneAlbumSelections(messages);
      if (!hasSameInChatResources(messages)) {
        cleanupInChatControls();
        messages.forEach(renderMessageControls);
        observeInChatLayout();
      }
      scheduleInChatLayout();
    } catch (error) {
      logger.error(
        `In-chat reconciliation failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      observeActiveRoot();
    }
  };

  const syncActiveChatRoot = () => {
    const nextRoot = findActiveChatRoot();
    const nextChatKey = getChatKey(nextRoot);
    const rootChanged = nextRoot !== inChatState.root;
    const chatChanged = nextChatKey !== inChatState.chatKey;
    if (!rootChanged && !chatChanged) return false;

    inChatState.observer?.disconnect();
    cleanupInChatControls();
    if (chatChanged) inChatState.albumSelections.clear();
    inChatState.root = nextRoot;
    inChatState.chatKey = nextChatKey;
    observeActiveRoot();
    return true;
  };

  function scheduleInChatReconcile() {
    if (inChatState.reconcileTimer !== null) {
      window.clearTimeout(inChatState.reconcileTimer);
    }
    inChatState.reconcileTimer = window.setTimeout(() => {
      inChatState.reconcileTimer = null;
      syncActiveChatRoot();
      reconcileInChatControls();
    }, IN_CHAT_RECONCILE_DELAY);
  }

  const startInChatLifecycle = () => {
    injectInChatStyles();
    syncActiveChatRoot();
    reconcileInChatControls();
    window.setInterval(() => {
      syncActiveChatRoot();
      reconcileInChatControls();
    }, IN_CHAT_ROOT_DISCOVERY_DELAY);
  };

  if (document.body) {
    startInChatLifecycle();
  } else {
    document.addEventListener("DOMContentLoaded", startInChatLifecycle, {
      once: true,
    });
  }

  // Progress bar container setup
  (function setupProgressBar() {
    const body = document.querySelector("body");
    if (!body || document.getElementById("tel-downloader-progress-bar-container")) {
      return;
    }
    const container = document.createElement("div");
    container.id = "tel-downloader-progress-bar-container";
    container.style.position = "fixed";
    container.style.bottom = 0;
    container.style.right = 0;
    if (detectWebApp() === "k") {
      container.style.zIndex = 4;
    } else {
      container.style.zIndex = 1600;
    }
    body.appendChild(container);
  })();

  logger.info("Completed script setup.");
})();
