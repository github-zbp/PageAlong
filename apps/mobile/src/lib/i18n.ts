import type { ReaderPreferences } from "@/lib/preferences";
import type { LocalePreference } from "@/lib/preferences";

type TaskGroupKey = "running" | "pending" | "completed" | "failed";

type TaskCopy = {
  statusLabels: Record<string, string>;
  typeLabels: {
    ttsGenerate: string;
    urlImport: string;
    courseExportPdf: string;
    courseExportDocx: string;
    courseExportMarkdown: string;
    fileImport: string;
    fileFolderImport: string;
    task: string;
  };
  groups: Record<TaskGroupKey, string>;
  download: string;
  retrySheet: {
    title: string;
    failureReason: string;
    noFailureReason: string;
    close: string;
    retry: string;
    missingCourseInfo: string;
    error: string;
  };
};

type ImportCopy = {
  title: string;
  textImport: {
    title: string;
    subtitle: string;
    titleLabel: string;
    titlePlaceholder: string;
    textLabel: string;
    textPlaceholder: string;
    submit: string;
    error: string;
  };
  fileImport: {
    title: string;
    subtitle: string;
    buttonTitle: string;
    buttonSubtitle: string;
    error: string;
  };
  urlBar: {
    inputLabel: string;
    placeholder: string;
    openLabel: string;
    invalidUrl: string;
  };
  web: {
    titleFallback: string;
    bookmarkLabel: string;
    error: string;
  };
  action: string;
};

type ShareCopy = {
  title: string;
  processing: string;
  waitingForLogin: string;
  invalidShare: string;
  failed: string;
  retry: string;
};

type AuthCopy = {
  brand: string;
  splash: {
    subtitle: string;
  };
  start: {
    slides: Array<{
      key: string;
      title: string;
      description: string;
      variant: "read" | "collect";
    }>;
    start: string;
    accessibilityLabel: (page: number) => string;
  };
  login: {
    backLabel: string;
    title: string;
    subtitle: string;
    passwordMethod: string;
    codeMethod: string;
    register: string;
    wechatUnavailable: string;
    oneTapUnavailable: string;
  };
  credentials: {
    backLabel: string;
    title: Record<"password" | "code", string>;
    subtitle: string;
    codeSentNotice: string;
    missingAccountSwitchNotice: string;
    loginFailed: string;
    sendCodeFailed: string;
    switchFailed: string;
  };
  register: {
    backLabel: string;
    title: string;
    subtitle: string;
    email: string;
    password: string;
    code: string;
    passwordPlaceholder: string;
    passwordHelp: string;
    sendCode: string;
    resendCode: (seconds: number) => string;
    submit: string;
    alreadyHaveAccount: string;
    login: string;
    codeSentNotice: string;
    sendCodeFailed: string;
    registerFailed: string;
  };
  consent: {
    label: string;
    privacy: string;
    terms: string;
  };
  provider: {
    wechat: string;
    oneTap: string;
  };
  methodTabs: {
    password: string;
    code: string;
  };
  form: {
    email: string;
    password: string;
    code: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    registerPasswordPlaceholder: string;
    codePlaceholder: string;
    login: string;
    completeRegister: string;
    sendCode: string;
    sendRegisterCode: string;
  };
};

type MeCopy = {
  title: string;
  languageAction: string;
  preferencesTitle: string;
  supportTitle: string;
  actionsTitle: string;
  accountInfo: string;
  readerPreferences: string;
  interfaceLanguage: string;
  theme: string;
  feedback: string;
  privacy: string;
  terms: string;
  signOut: string;
  signOutAll: string;
  loading: string;
  languageValues: Record<LocalePreference, string>;
  themeValues: Record<"light" | "dark", string>;
};

type WorkbenchCopy = {
  title: string;
  action: string;
  continueLearning: string;
  recentReading: string;
  signedInPrefix: string;
  signedOutBody: string;
  recentBody: string;
};

type LibraryCopy = {
  title: string;
  action: string;
  close: string;
  bodyTitle: string;
  body: string;
  newSeries: string;
  newTag: string;
  continueReading: string;
  seriesInputLabel: string;
  seriesInputPlaceholder: string;
  seriesSubmit: string;
  seriesError: string;
};

type DownloadsCopy = {
  title: string;
  action: string;
  introTitle: string;
  introBody: string;
  loading: string;
  emptyTitle: string;
  emptyBody: string;
  loadMore: string;
  loadingMore: string;
};

type ReaderCopy = {
  back: string;
  close: string;
  retry: string;
  preferences: string;
  tags: string;
  addTag: string;
  tagInputLabel: string;
  tagInputPlaceholder: string;
  tagSubmit: string;
  tagEmpty: string;
  tagRemove: string;
  tagError: string;
  outline: string;
  closeOutline: string;
  seriesDirectory: string;
  download: string;
  star: string;
  unstar: string;
  play: string;
  pause: string;
  expandPlayer: string;
  closePlayer: string;
  restorePlayer: string;
  currentSentence: string;
  speed: string;
  loadingCourse: string;
  loadError: string;
  generatingAudio: string;
  queuedNotice: string;
  formatTitle: string;
  formats: {
    markdown: string;
    docx: string;
    pdf: string;
    audio: string;
  };
};

type ReaderPreferencesCopy = {
  title: string;
  fontSize: string;
  lineHeight: string;
  playbackRate: string;
  done: string;
  close: string;
  small: string;
  standard: string;
  large: string;
  compact: string;
  comfortable: string;
  loose: string;
};

type FeedbackCopy = {
  title: string;
  close: string;
  submit: string;
  category: string;
  summary: string;
  message: string;
  success: string;
  failure: string;
  categories: Record<"suggestion" | "bug" | "feature", string>;
};

type LanguageCopy = {
  title: string;
  close: string;
  done: string;
  chinese: string;
  english: string;
};

function formatLocaleDateTime(value: string, locale: LocalePreference): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatReaderPreferencesSummary(preferences: ReaderPreferences, locale: LocalePreference): string {
  const copy = getReaderPreferencesCopy(locale);
  const fontLabel =
    preferences.fontSize === "small" ? copy.small : preferences.fontSize === "large" ? copy.large : copy.standard;
  const lineHeightLabel =
    preferences.lineHeight === "compact" ? copy.compact : preferences.lineHeight === "loose" ? copy.loose : copy.comfortable;
  const speedLabel =
    preferences.playbackRate === 1
      ? "1.0x"
      : Number.isInteger(preferences.playbackRate)
        ? `${preferences.playbackRate.toFixed(1)}x`
        : `${preferences.playbackRate}x`;
  return `${fontLabel} · ${lineHeightLabel} · ${speedLabel}`;
}

export function formatTaskUpdatedAt(value: string, locale: LocalePreference): string {
  return formatLocaleDateTime(value, locale);
}

export function getTaskCopy(locale: LocalePreference): TaskCopy {
  if (locale === "en") {
    return {
      statusLabels: {
        pending: "Pending",
        running: "Running",
        succeeded: "Completed",
        completed: "Completed",
        completed_with_failures: "Partial failure",
        failed: "Failed"
      },
      typeLabels: {
        ttsGenerate: "Audio generation",
        urlImport: "Import",
        courseExportPdf: "PDF export",
        courseExportDocx: "Word export",
        courseExportMarkdown: "Markdown export",
        fileImport: "File import",
        fileFolderImport: "Folder import",
        task: "Task"
      },
      groups: {
        running: "Running",
        pending: "Pending",
        completed: "Completed",
        failed: "Failed"
      },
      download: "Download",
      retrySheet: {
        title: "Failed task",
        failureReason: "Failure reason",
        noFailureReason: "No failure reason yet",
        close: "Close",
        retry: "Retry",
        missingCourseInfo: "Missing course info",
        error: "Retry failed"
      }
    };
  }

  return {
    statusLabels: {
      pending: "待处理",
      running: "进行中",
      succeeded: "已完成",
      completed: "已完成",
      completed_with_failures: "部分失败",
      failed: "失败"
    },
    typeLabels: {
      ttsGenerate: "音频生成",
      urlImport: "导入",
      courseExportPdf: "PDF 导出",
      courseExportDocx: "Word 导出",
      courseExportMarkdown: "Markdown 导出",
      fileImport: "文件导入",
      fileFolderImport: "文件夹导入",
      task: "任务"
    },
    groups: {
      running: "进行中",
      pending: "待处理",
      completed: "已完成",
      failed: "失败"
    },
    download: "下载",
    retrySheet: {
      title: "失败任务",
      failureReason: "失败原因",
      noFailureReason: "暂无失败原因",
      close: "关闭",
      retry: "重试",
      missingCourseInfo: "缺少课程信息",
      error: "重试失败"
    }
  };
}

export function getImportCopy(locale: LocalePreference): ImportCopy {
  if (locale === "en") {
    return {
      title: "Import",
      textImport: {
        title: "Text import",
        subtitle: "Paste text directly into a course",
        titleLabel: "Optional title",
        titlePlaceholder: "Optional title",
        textLabel: "Paste the text to turn into a course",
        textPlaceholder: "Paste the text to turn into a course",
        submit: "Done",
        error: "Text import failed"
      },
      fileImport: {
        title: "File import",
        subtitle: "Choose one or more files and send them to the task center",
        buttonTitle: "File import",
        buttonSubtitle: "Choose one or more files and send them to the task center",
        error: "File import failed"
      },
      urlBar: {
        inputLabel: "URL input",
        placeholder: "Paste a URL to save it as a course",
        openLabel: "Open web page",
        invalidUrl: "Enter a valid URL"
      },
      web: {
        titleFallback: "Web page",
        bookmarkLabel: "Save page",
        error: "Failed to save page"
      },
      action: "Import"
    };
  }

  return {
    title: "导入",
    textImport: {
      title: "文本导入",
      subtitle: "把一段文字直接转成课程",
      titleLabel: "标题，可选",
      titlePlaceholder: "标题，可选",
      textLabel: "粘贴要转成课程的文本",
      textPlaceholder: "粘贴要转成课程的文本",
      submit: "完成",
      error: "文本导入失败"
    },
    fileImport: {
      title: "文件导入",
      subtitle: "选择一个或多个文件，生成课程并进入任务中心",
      buttonTitle: "文件导入",
      buttonSubtitle: "选择一个或多个文件，生成课程并进入任务中心",
      error: "文件导入失败"
    },
    urlBar: {
      inputLabel: "网址输入",
      placeholder: "输入网址，收藏为课程并生成音频",
      openLabel: "打开网页",
      invalidUrl: "请输入有效网址"
    },
    web: {
      titleFallback: "网页浏览",
      bookmarkLabel: "收藏网页",
      error: "收藏失败"
    },
    action: "导入"
  };
}

export function getShareCopy(locale: LocalePreference): ShareCopy {
  if (locale === "en") {
    return {
      title: "Share import",
      processing: "Importing the shared page",
      waitingForLogin: "Sign in to continue importing this share",
      invalidShare: "Only web links are supported",
      failed: "Failed to import the shared page",
      retry: "Retry"
    };
  }

  return {
    title: "分享导入",
    processing: "正在导入分享页面",
    waitingForLogin: "登录后继续导入这条分享",
    invalidShare: "只支持网页链接",
    failed: "分享导入失败",
    retry: "重试"
  };
}

export function getAuthCopy(locale: LocalePreference): AuthCopy {
  if (locale === "en") {
    return {
      brand: "PageAlong",
      splash: {
        subtitle: "Restoring sign-in state"
      },
      start: {
        slides: [
          {
            key: "read",
            title: "Turn docs and web pages into audio for the commute",
            description: "Keep the articles and notes you care about in one place, then continue reading or listening later.",
            variant: "read"
          },
          {
            key: "collect",
            title: "Return to where you left off",
            description: "Your learning record stays with you, so you can pick up from the last point anytime.",
            variant: "collect"
          }
        ],
        start: "Start",
        accessibilityLabel: (page) => `Go to page ${page}`
      },
      login: {
        backLabel: "Back to start",
        title: "Choose a sign-in method",
        subtitle: "Pick an entry point, then continue to your learning record.",
        passwordMethod: "Password sign-in",
        codeMethod: "Email code sign-in",
        register: "Register",
        wechatUnavailable: "WeChat sign-in is open, but third-party auth is not connected yet.",
        oneTapUnavailable: "One-tap sign-in is open, but third-party auth is not connected yet."
      },
      credentials: {
        backLabel: "Back",
        title: {
          password: "Email password sign-in",
          code: "Email code sign-in"
        },
        subtitle: "Enter your email and credentials here to continue to your learning record.",
        codeSentNotice: "The code has been sent. Check your spam folder if needed.",
        missingAccountSwitchNotice: "No account found, switched to register and sent a code.",
        loginFailed: "Sign-in failed",
        sendCodeFailed: "Failed to send code",
        switchFailed: "Failed to switch to register"
      },
      register: {
        backLabel: "Back",
        title: "Register",
        subtitle: "Verify your email first, then set a password.",
        email: "Email",
        password: "Password",
        code: "Code",
        passwordPlaceholder: "At least 8 characters",
        passwordHelp: "At least 8 characters",
        sendCode: "Send code",
        resendCode: (seconds) => `Resend (${seconds})`,
        submit: "Register",
        alreadyHaveAccount: "Already have an account?",
        login: "Sign in",
        codeSentNotice: "The code has been sent. Check your spam folder if needed.",
        sendCodeFailed: "Failed to send code",
        registerFailed: "Registration failed"
      },
      consent: {
        label: "I have read and agree to the service agreement, privacy policy, and terms of service",
        privacy: "Privacy policy",
        terms: "Terms"
      },
      provider: {
        wechat: "WeChat sign-in",
        oneTap: "One-tap sign-in"
      },
      methodTabs: {
        password: "Password sign-in",
        code: "Email code"
      },
      form: {
        email: "Email",
        password: "Password",
        code: "Code",
        emailPlaceholder: "reader@example.com",
        passwordPlaceholder: "At least 8 characters",
        registerPasswordPlaceholder: "Set a sign-in password",
        codePlaceholder: "6-digit code",
        login: "Sign in",
        completeRegister: "Complete registration",
        sendCode: "Send code",
        sendRegisterCode: "Send register code"
      }
    };
  }

  return {
    brand: "PageAlong",
    splash: {
      subtitle: "正在恢复登录态"
    },
    start: {
      slides: [
        {
          key: "read",
          title: "把文档和网页变成音频，通勤也能听",
          description: "把平时散落各处的文档和网页收藏到一起，后面继续读，继续听。",
          variant: "read"
        },
        {
          key: "collect",
          title: "回到上次的位置",
          description: "学习记录会保留下来，随时都能接着往下走。",
          variant: "collect"
        }
      ],
      start: "开始",
      accessibilityLabel: (page) => `切换到第 ${page} 页`
    },
    login: {
      backLabel: "返回开始页",
      title: "选择登录方式",
      subtitle: "先选一种入口，再继续到你的学习记录。",
      passwordMethod: "密码登录",
      codeMethod: "邮箱验证码登录",
      register: "注册",
      wechatUnavailable: "微信登录入口已打开，当前还未接入第三方授权",
      oneTapUnavailable: "一键登录入口已打开，当前还未接入第三方授权"
    },
    credentials: {
      backLabel: "返回",
      title: {
        password: "邮箱密码登录",
        code: "邮箱验证码登录"
      },
      subtitle: "在这里输入邮箱和凭证，继续进入学习记录。",
      codeSentNotice: "验证码已发送，如果没找到请到邮件垃圾箱看看~",
      missingAccountSwitchNotice: "未找到账号，已切换为注册并发送验证码。",
      loginFailed: "登录失败",
      sendCodeFailed: "发送验证码失败",
      switchFailed: "切换到注册失败"
    },
    register: {
      backLabel: "返回",
      title: "注册",
      subtitle: "先验证邮箱，再设置密码。",
      email: "邮箱",
      password: "密码",
      code: "验证码",
      passwordPlaceholder: "至少 8 位",
      passwordHelp: "至少 8 位",
      sendCode: "发送验证码",
      resendCode: (seconds) => `重新发送 (${seconds})`,
      submit: "注册",
      alreadyHaveAccount: "已有账号？",
      login: "登录",
      codeSentNotice: "验证码已发送，如果没找到请到邮件垃圾箱看看~",
      sendCodeFailed: "发送验证码失败",
      registerFailed: "注册失败"
    },
    consent: {
      label: "我已阅读并同意服务协议、隐私政策和用户条款",
      privacy: "隐私政策",
      terms: "用户条款"
    },
    provider: {
      wechat: "微信登录",
      oneTap: "一键登录"
    },
    methodTabs: {
      password: "密码登录",
      code: "邮箱验证码"
    },
    form: {
      email: "邮箱",
      password: "密码",
      code: "验证码",
      emailPlaceholder: "reader@example.com",
      passwordPlaceholder: "至少 8 位",
      registerPasswordPlaceholder: "设置登录密码",
      codePlaceholder: "6 位验证码",
      login: "登录",
      completeRegister: "完成注册",
      sendCode: "发送验证码",
      sendRegisterCode: "发送注册验证码"
    }
  };
}

export function getMeCopy(locale: LocalePreference): MeCopy {
  if (locale === "en") {
    return {
      title: "Me",
      languageAction: "Language",
      preferencesTitle: "Preferences",
      supportTitle: "Support",
      actionsTitle: "Actions",
      accountInfo: "Account",
      readerPreferences: "Reading preferences",
      interfaceLanguage: "Interface language",
      theme: "Theme",
      feedback: "Feedback",
      privacy: "Privacy policy",
      terms: "Terms",
      signOut: "Sign out",
      signOutAll: "Sign out all devices",
      loading: "Loading account...",
      languageValues: {
        zh: "Simplified Chinese",
        en: "English"
      },
      themeValues: {
        light: "Day",
        dark: "Night"
      }
    };
  }

  return {
    title: "我的",
    languageAction: "语言",
    preferencesTitle: "偏好",
    supportTitle: "支持",
    actionsTitle: "账户",
    accountInfo: "账号信息",
    readerPreferences: "阅读偏好",
    interfaceLanguage: "界面语言",
    theme: "主题",
    feedback: "反馈",
    privacy: "隐私政策",
    terms: "用户条款",
    signOut: "退出登录",
    signOutAll: "退出所有设备",
    loading: "账号信息加载中...",
    languageValues: {
      zh: "简体中文",
      en: "English"
    },
    themeValues: {
      light: "白天",
      dark: "夜间"
    }
  };
}

export function getWorkbenchCopy(locale: LocalePreference): WorkbenchCopy {
  if (locale === "en") {
    return {
      title: "Workbench",
      action: "Import",
      continueLearning: "Continue learning",
      recentReading: "Recent reading",
      signedInPrefix: "Current account: ",
      signedOutBody: "The session will reappear once the login flow is connected later.",
      recentBody: "The course list will be connected in a later stage."
    };
  }

  return {
    title: "工作台",
    action: "导入",
    continueLearning: "继续学习",
    recentReading: "最近阅读",
    signedInPrefix: "当前账号：",
    signedOutBody: "会话会在后续登录流程接入后恢复。",
    recentBody: "这里会在后续 spec 中接入课程列表。"
  };
}

export function getLibraryCopy(locale: LocalePreference): LibraryCopy {
  if (locale === "en") {
    return {
      title: "Library",
      action: "Import course",
      close: "Close",
      bodyTitle: "Library",
      body: "Course list and filters will arrive in the next stage.",
      newSeries: "New series course",
      newTag: "New tag",
      continueReading: "Continue reading",
      seriesInputLabel: "Series title",
      seriesInputPlaceholder: "Enter a series title",
      seriesSubmit: "Create series",
      seriesError: "Failed to create series"
    };
  }

  return {
    title: "课程库",
    action: "导入课程",
    close: "关闭",
    bodyTitle: "课程库",
    body: "课程列表与筛选会在下一阶段接入。",
    newSeries: "新建系列课程",
    newTag: "新建标签",
    continueReading: "继续阅读",
    seriesInputLabel: "系列标题",
    seriesInputPlaceholder: "输入系列标题",
    seriesSubmit: "创建系列",
    seriesError: "创建系列失败"
  };
}

export function getDownloadsCopy(locale: LocalePreference): DownloadsCopy {
  if (locale === "en") {
    return {
      title: "Downloads",
      action: "Import",
      introTitle: "Import and download tasks",
      introBody: "Grouped by running, pending, completed, and failed.",
      loading: "Loading tasks...",
      emptyTitle: "No tasks yet",
      emptyBody: "Imported content, audio generation, and download tasks will appear here.",
      loadMore: "Load more",
      loadingMore: "Loading more..."
    };
  }

  return {
    title: "下载资源",
    action: "导入",
    introTitle: "导入与下载任务",
    introBody: "按进行中、待处理、已完成和失败分组显示。",
    loading: "正在加载任务...",
    emptyTitle: "暂无任务",
    emptyBody: "导入、音频生成和下载任务会出现在这里。",
    loadMore: "加载更多",
    loadingMore: "正在加载更多..."
  };
}

export function getReaderCopy(locale: LocalePreference): ReaderCopy {
  if (locale === "en") {
    return {
      back: "Back",
      close: "Close",
      retry: "Retry",
      preferences: "Reading preferences",
      tags: "Tags",
      addTag: "Add tag",
      tagInputLabel: "Tag name",
      tagInputPlaceholder: "Enter a tag",
      tagSubmit: "Confirm",
      tagEmpty: "No tags yet",
      tagRemove: "Remove",
      tagError: "Failed to update tags",
      outline: "Outline",
      closeOutline: "Close outline",
      seriesDirectory: "Series directory",
      download: "Download",
      star: "Star",
      unstar: "Unstar",
      play: "Play",
      pause: "Pause",
      expandPlayer: "Open player",
      closePlayer: "Close player",
      restorePlayer: "Show player bar",
      currentSentence: "Current sentence",
      speed: "Playback speed",
      loadingCourse: "Loading course...",
      loadError: "Failed to load course",
      generatingAudio: "Generating audio...",
      queuedNotice: "The file is being generated. Open the download tasks page to track progress.",
      formatTitle: "Download format",
      formats: {
        markdown: "Markdown",
        docx: "Word",
        pdf: "PDF",
        audio: "Audio"
      }
    };
  }

  return {
    back: "返回",
    close: "关闭",
    retry: "重试",
    preferences: "阅读偏好",
    tags: "标签",
    addTag: "添加标签",
    tagInputLabel: "标签名称",
    tagInputPlaceholder: "输入新标签",
    tagSubmit: "确认",
    tagEmpty: "暂无标签",
    tagRemove: "删除",
    tagError: "标签更新失败",
    outline: "目录",
    closeOutline: "关闭目录",
    seriesDirectory: "系列目录",
    download: "下载",
    star: "收藏",
    unstar: "取消收藏",
    play: "播放",
    pause: "暂停",
    expandPlayer: "打开播放器",
    closePlayer: "收起播放器",
    restorePlayer: "展开播放器",
    currentSentence: "当前句子",
    speed: "播放速度",
    loadingCourse: "正在加载课程...",
    loadError: "课程加载失败",
    generatingAudio: "正在生成音频...",
    queuedNotice: "文件正在生成中，前往下载任务页查看进度。",
    formatTitle: "下载格式",
    formats: {
      markdown: "Markdown",
      docx: "Word",
      pdf: "PDF",
      audio: "音频"
    }
  };
}

export function getReaderPreferencesCopy(locale: LocalePreference): ReaderPreferencesCopy {
  if (locale === "en") {
    return {
      title: "Reading Preferences",
      fontSize: "Font size",
      lineHeight: "Line height",
      playbackRate: "Playback rate",
      done: "Done",
      close: "Close",
      small: "Small",
      standard: "Standard",
      large: "Large",
      compact: "Compact",
      comfortable: "Comfortable",
      loose: "Loose"
    };
  }

  return {
    title: "阅读偏好",
    fontSize: "字号",
    lineHeight: "行高",
    playbackRate: "播放速度",
    done: "完成",
    close: "关闭",
    small: "小字",
    standard: "标准",
    large: "大字",
    compact: "紧凑",
    comfortable: "舒适",
    loose: "宽松"
  };
}

export function getFeedbackCopy(locale: LocalePreference): FeedbackCopy {
  if (locale === "en") {
    return {
      title: "Feedback",
      close: "Close",
      submit: "Send",
      category: "Category",
      summary: "Summarize the issue",
      message: "Details",
      success: "Feedback sent",
      failure: "Failed to send feedback",
      categories: {
        suggestion: "Suggestion",
        bug: "Issue",
        feature: "Feature"
      }
    };
  }

  return {
    title: "反馈",
    close: "关闭",
    submit: "发送",
    category: "分类",
    summary: "一句话概括问题",
    message: "详细说明",
    success: "反馈已发送",
    failure: "反馈发送失败",
    categories: {
      suggestion: "建议",
      bug: "问题",
      feature: "功能"
    }
  };
}

export function getLanguageCopy(locale: LocalePreference): LanguageCopy {
  if (locale === "en") {
    return {
      title: "Interface Language",
      close: "Close",
      done: "Done",
      chinese: "Simplified Chinese",
      english: "English"
    };
  }

  return {
    title: "界面语言",
    close: "关闭",
    done: "完成",
    chinese: "简体中文",
    english: "English"
  };
}
