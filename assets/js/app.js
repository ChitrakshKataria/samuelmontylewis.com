(function () {
  const DEMO_POSTS = [
    {
      id: "demo1",
      slug: "on-writing-every-day",
      title: "On writing every day",
      published_at: "2026-04-15",
      excerpt: "The habit, not the output, is the point.",
      content:
        "Writing every day is less about producing great work and more about keeping the channel open. Most of what you write will be mediocre. That is fine. The practice is the point.\n\nSome days you sit down and nothing comes. You write anyway. A sentence, a paragraph, a bad idea fully formed. The act of showing up is the work.\n\nOver time, the quality improves not because you tried harder but because you showed up more. Consistency compounds in ways that effort alone never does.",
      status: "published"
    },
    {
      id: "demo2",
      slug: "notes-on-simplicity",
      title: "Notes on simplicity",
      published_at: "2026-03-28",
      excerpt: "What gets removed is as important as what stays.",
      content:
        "Simplicity is not the absence of things. It is the presence of the right things.\n\nEvery element in a design, a sentence, a system should earn its place. If you cannot say why something is there, it probably should not be.\n\nThe hardest part is knowing what to cut. Addition is easy. Subtraction requires judgment.",
      status: "published"
    },
    {
      id: "demo3",
      slug: "reading-slowly",
      title: "Reading slowly",
      published_at: "2026-02-10",
      excerpt: "Speed reading is just skimming with confidence.",
      content:
        "I used to try to read fast. More books, more ideas, more input. It did not work. I retained very little and understood even less.\n\nReading slowly changed everything. When you slow down, you notice the structure of an argument. You catch the moment a writer is hedging. You feel the weight of a sentence.\n\nNow I read fewer books and understand them better. That seems like the right trade.",
      status: "published"
    }
  ];

  const config = {
    url: window.SML_SUPABASE_URL || "",
    anonKey: window.SML_SUPABASE_ANON_KEY || "",
    basePath: (window.SML_BASE_PATH || "").replace(/\/$/, ""),
    siteUrl: (window.SML_SITE_URL || "").replace(/\/$/, "")
  };

  const configured = Boolean(
    config.url &&
      config.anonKey &&
      !config.anonKey.includes("paste") &&
      window.supabase
  );

  const client = configured
    ? window.supabase.createClient(config.url, config.anonKey)
    : null;

  const COMMENT_MODERATION_STORAGE_KEY = "sml-comment-moderation-level";
  const COMMENT_MODERATION_CHANGE_EVENT = "sml:comment-moderation-change";
  const COMMENT_MODERATION_LIBRARY_EVENT = "sml:comment-moderation-library-ready";
  const COMMENT_MODERATION_LEVELS = {
    0: {
      value: 0,
      label: "Off",
      description: "No masking. Comments render exactly as written.",
      collapseRuns: false,
      detectSeparatedLetters: false
    },
    1: {
      value: 1,
      label: "Light",
      description: "Masks direct matches and obvious leetspeak.",
      collapseRuns: false,
      detectSeparatedLetters: false
    },
    2: {
      value: 2,
      label: "Balanced",
      description: "Also catches stretched spellings like crazzzyyyy shiiiiiiit.",
      collapseRuns: true,
      detectSeparatedLetters: false
    },
    3: {
      value: 3,
      label: "Strict",
      description: "Also catches spaced and punctuated spellings like s h i t or s.h.i.t.",
      collapseRuns: true,
      detectSeparatedLetters: true
    }
  };
  const COMMENT_MODERATION_CUSTOM_TERMS = [
    { term: "asshole", mode: "substring" },
    { term: "bastard", mode: "substring" },
    { term: "bitch", mode: "substring" },
    { term: "bullshit", mode: "substring" },
    { term: "cunt", mode: "substring" },
    { term: "dickhead", mode: "substring" },
    { term: "faggot", mode: "token" },
    { term: "fuck", mode: "substring" },
    { term: "motherfucker", mode: "substring" },
    { term: "nigga", mode: "token" },
    { term: "nigger", mode: "token" },
    { term: "pussy", mode: "substring" },
    { term: "retard", mode: "token" },
    { term: "shit", mode: "substring" },
    { term: "slut", mode: "token" },
    { term: "whore", mode: "token" }
  ];
  const COMMENT_MODERATION_LIBRARY_PATH = "/assets/data/leo-profanity-en.json";
  const COMMENT_MODERATION_WHITELIST = [
    "assistant",
    "classic",
    "glass",
    "passage",
    "scunthorpe"
  ];
  const LEET_NORMALIZATION_MAP = {
    "@": "a",
    "0": "o",
    "1": "i",
    "3": "e",
    "4": "a",
    "5": "s",
    "7": "t",
    "8": "b",
    "9": "g",
    "!": "i",
    "$": "s",
    "+": "t",
    "|": "i"
  };
  const LEET_REGEX_MAP = {
    a: "[a4@]",
    b: "[b8]",
    e: "[e3]",
    g: "[g69]",
    i: "[i1!|l]",
    o: "[o0]",
    s: "[s5$]",
    t: "[t7+]"
  };
  let compiledCommentModerationTerms = null;
  let commentModerationLibraryWords = [];
  let commentModerationLibraryLoaded = false;
  let commentModerationLibraryPromise = null;

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function formatDate(date) {
    return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  function formatDateTime(value) {
    return new Date(value).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function shortDate(date) {
    return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      month: "long",
      day: "numeric"
    });
  }

  function countWords(text) {
    return String(text || "").trim()
      ? String(text || "").trim().split(/\s+/).length
      : 0;
  }

  function postUrl(post) {
    return siteUrl(`/posts/${encodeURIComponent(post.slug)}/`);
  }

  function siteUrl(path) {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${config.basePath}${cleanPath}` || "/";
  }

  function absoluteSiteUrl(path) {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    if (config.siteUrl) return `${config.siteUrl}${cleanPath}`;
    return `${window.location.origin}${siteUrl(cleanPath)}`;
  }

  function authRedirectUrl() {
    return absoluteSiteUrl("/email-confirmed/");
  }

  function authRecoveryUrl() {
    return absoluteSiteUrl("/reset-password/");
  }

  function stripBasePath(pathname) {
    if (config.basePath && pathname.startsWith(config.basePath)) {
      return pathname.slice(config.basePath.length) || "/";
    }
    return pathname;
  }

  function setActiveNav(route) {
    document.querySelectorAll("nav a[data-route]").forEach((link) => {
      link.classList.toggle("active", link.dataset.route === route);
    });
  }

  function publicApp() {
    return document.getElementById("app");
  }

  function renderParagraphs(text) {
    return String(text || "")
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  function sortPosts(posts) {
    return [...posts].sort(
      (a, b) => new Date(b.published_at) - new Date(a.published_at)
    );
  }

  function validPosts(posts) {
    return (posts || []).filter((post) => post && post.slug && post.title);
  }

  function setNotice(element, message, isError) {
    if (!element) return;
    element.textContent = message || "";
    element.classList.toggle("error", Boolean(isError));
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function normalizeComparableChar(char) {
    const normalized = String(char || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "");
    if (!normalized) return "";
    const mapped = LEET_NORMALIZATION_MAP[normalized[0]] || normalized[0];
    return /[a-z0-9]/.test(mapped) ? mapped : "";
  }

  function normalizeComparableText(value) {
    const chars = [];
    for (const char of String(value || "")) {
      const normalized = normalizeComparableChar(char);
      if (normalized) chars.push(normalized);
    }
    return chars.join("");
  }

  function collapseMappedCharacters(chars, indexMap) {
    const collapsedChars = [];
    const collapsedMap = [];
    chars.forEach((char, index) => {
      if (collapsedChars[collapsedChars.length - 1] === char) return;
      collapsedChars.push(char);
      collapsedMap.push(indexMap[index]);
    });
    return {
      text: collapsedChars.join(""),
      map: collapsedMap
    };
  }

  function buildNormalizedTokenMaps(text) {
    const tokens = [];
    const source = String(text || "");
    const tokenRegex = /[A-Za-z0-9@!$+|]+/g;
    let match;

    while ((match = tokenRegex.exec(source))) {
      const raw = match[0];
      const start = match.index;
      const chars = [];
      const indexMap = [];

      for (let offset = 0; offset < raw.length; offset += 1) {
        const normalized = normalizeComparableChar(raw[offset]);
        if (!normalized) continue;
        chars.push(normalized);
        indexMap.push(start + offset);
      }

      if (!chars.length) continue;

      const collapsed = collapseMappedCharacters(chars, indexMap);
      tokens.push({
        start,
        end: start + raw.length,
        normalized: chars.join(""),
        indexMap,
        collapsedNormalized: collapsed.text,
        collapsedIndexMap: collapsed.map
      });
    }

    return tokens;
  }

  function buildSeparatedPatternSource(term) {
    return normalizeComparableText(term)
      .split("")
      .map((char) => `${LEET_REGEX_MAP[char] || escapeRegExp(char)}+`)
      .join("(?:[^a-z0-9]+)*");
  }

  function getCompiledCommentModerationTerms() {
    if (compiledCommentModerationTerms) return compiledCommentModerationTerms;

    const customPatterns = COMMENT_MODERATION_CUSTOM_TERMS.map((item) => ({
      ...item,
      normalized: normalizeComparableText(item.term),
      separatedPatternSource: buildSeparatedPatternSource(item.term)
    }));
    const libraryPatterns = commentModerationLibraryWords.map((term) => ({
      term,
      mode: "token",
      normalized: normalizeComparableText(term),
      separatedPatternSource: buildSeparatedPatternSource(term),
      source: "leo-profanity"
    }));

    compiledCommentModerationTerms = [...customPatterns, ...libraryPatterns];

    return compiledCommentModerationTerms;
  }

  function normalizeModerationWordList(words) {
    return [...new Set(
      (words || [])
        .map((word) => normalizeComparableText(word))
        .filter((word) => word && word.length > 1 && !COMMENT_MODERATION_WHITELIST.includes(word))
    )];
  }

  async function ensureCommentModerationLibraryLoaded() {
    if (commentModerationLibraryLoaded) return;
    if (commentModerationLibraryPromise) {
      await commentModerationLibraryPromise;
      return;
    }

    commentModerationLibraryPromise = fetch(siteUrl(COMMENT_MODERATION_LIBRARY_PATH))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load moderation dictionary (${response.status}).`);
        }
        return response.json();
      })
      .then((words) => {
        commentModerationLibraryWords = normalizeModerationWordList(words);
        compiledCommentModerationTerms = null;
        commentModerationLibraryLoaded = true;
        window.dispatchEvent(new CustomEvent(COMMENT_MODERATION_LIBRARY_EVENT));
      })
      .catch(() => {
        commentModerationLibraryWords = [];
        commentModerationLibraryLoaded = false;
      })
      .finally(() => {
        commentModerationLibraryPromise = null;
      });

    await commentModerationLibraryPromise;
  }

  function readCommentModerationLevel() {
    try {
      const raw = Number(window.localStorage.getItem(COMMENT_MODERATION_STORAGE_KEY));
      return Number.isInteger(raw) && COMMENT_MODERATION_LEVELS[raw]
        ? raw
        : 2;
    } catch {
      return 2;
    }
  }

  function getCommentModerationProfile() {
    return COMMENT_MODERATION_LEVELS[readCommentModerationLevel()] || COMMENT_MODERATION_LEVELS[2];
  }

  function setCommentModerationLevel(value) {
    const numericValue = Number(value);
    const nextValue = COMMENT_MODERATION_LEVELS[numericValue] ? numericValue : 2;

    try {
      window.localStorage.setItem(COMMENT_MODERATION_STORAGE_KEY, String(nextValue));
    } catch {}

    window.dispatchEvent(
      new CustomEvent(COMMENT_MODERATION_CHANGE_EVENT, {
        detail: getCommentModerationProfile()
      })
    );
  }

  function collectTokenMatches(source, indexMap, token, pattern) {
    if (!source || !pattern.normalized) return [];

    if (pattern.mode === "token") {
      return source === pattern.normalized
        ? [{ start: token.start, end: token.end, term: pattern.term }]
        : [];
    }

    const ranges = [];
    let fromIndex = 0;

    while (fromIndex < source.length) {
      const matchIndex = source.indexOf(pattern.normalized, fromIndex);
      if (matchIndex === -1) break;
      const start = indexMap[matchIndex];
      const end = indexMap[matchIndex + pattern.normalized.length - 1] + 1;
      ranges.push({ start, end, term: pattern.term });
      fromIndex = matchIndex + pattern.normalized.length;
    }

    return ranges;
  }

  function collectSeparatedMatches(text, patterns) {
    const ranges = [];
    const source = String(text || "").toLowerCase();

    patterns.forEach((pattern) => {
      const regex = new RegExp(pattern.separatedPatternSource, "gi");
      let match;

      while ((match = regex.exec(source))) {
        const start = match.index;
        const end = start + match[0].length;
        const before = source[start - 1];
        const after = source[end];

        if (pattern.mode === "token" && ((before && /[a-z0-9]/.test(before)) || (after && /[a-z0-9]/.test(after)))) {
          continue;
        }

        ranges.push({ start, end, term: pattern.term });
      }
    });

    return ranges;
  }

  function mergeRanges(ranges) {
    if (!ranges.length) return [];

    const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
    const merged = [sorted[0]];

    for (let index = 1; index < sorted.length; index += 1) {
      const current = sorted[index];
      const previous = merged[merged.length - 1];

      if (current.start <= previous.end) {
        previous.end = Math.max(previous.end, current.end);
        continue;
      }

      merged.push({ ...current });
    }

    return merged;
  }

  function maskCommentRanges(text, ranges) {
    if (!ranges.length) return String(text || "");

    const chars = String(text || "").split("");
    ranges.forEach((range) => {
      for (let index = range.start; index < range.end; index += 1) {
        if (normalizeComparableChar(chars[index])) chars[index] = "*";
      }
    });
    return chars.join("");
  }

  function moderateCommentText(text) {
    const original = String(text || "");
    const profile = getCommentModerationProfile();
    if (!original || profile.value === 0) {
      return {
        text: original,
        matches: [],
        profile
      };
    }

    const patterns = getCompiledCommentModerationTerms();
    const tokens = buildNormalizedTokenMaps(original);
    const matches = [];

    tokens.forEach((token) => {
      patterns.forEach((pattern) => {
        matches.push(...collectTokenMatches(token.normalized, token.indexMap, token, pattern));
        if (profile.collapseRuns) {
          matches.push(...collectTokenMatches(token.collapsedNormalized, token.collapsedIndexMap, token, pattern));
        }
      });
    });

    if (profile.detectSeparatedLetters) {
      matches.push(...collectSeparatedMatches(original, patterns));
    }

    const mergedMatches = mergeRanges(matches);
    return {
      text: maskCommentRanges(original, mergedMatches),
      matches: mergedMatches,
      profile
    };
  }

  function commentModerationNotice(result, action) {
    if (!result.matches.length || result.profile.value === 0) return "";
    const plural = result.matches.length === 1 ? "" : "s";
    if (action === "Posted") {
      return `Comment posted. ${result.matches.length} word${plural} was hidden automatically.`;
    }
    if (action === "Saved") {
      return `Comment updated. ${result.matches.length} word${plural} was hidden automatically.`;
    }
    return `${action}. ${result.matches.length} word${plural} was hidden automatically.`;
  }

  function readHashParams() {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    return new URLSearchParams(hash);
  }

  function withTimeout(promise, message = "Request timed out.", ms = 6000) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error(message)), ms);
      })
    ]);
  }

  async function restGet(path, params = {}, message = "Request timed out.") {
    if (!configured) throw new Error("Supabase is not configured.");

    const url = new URL(`${config.url}/rest/v1/${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, value);
    });

    const response = await withTimeout(
      fetch(url.toString(), {
        headers: {
          apikey: config.anonKey,
          authorization: `Bearer ${config.anonKey}`
        }
      }),
      message,
      12000
    );

    if (!response.ok) {
      let detail = "";
      try {
        const body = await response.json();
        detail = body.message || body.hint || "";
      } catch {
        detail = response.statusText;
      }
      throw new Error(detail || `Request failed with ${response.status}.`);
    }

    return response.json();
  }

  async function listPublishedPosts(limit) {
    if (!configured) return sortPosts(DEMO_POSTS).slice(0, limit || DEMO_POSTS.length);

    return restGet(
      "posts",
      {
        select: "id,slug,title,excerpt,content,status,published_at,created_at,updated_at",
        status: "eq.published",
        order: "published_at.desc",
        limit
      },
      "Posts took too long to load."
    );
  }

  async function listAllPosts() {
    if (!client) return sortPosts(DEMO_POSTS);
    const { data, error } = await withTimeout(client
      .from("posts")
      .select("id, slug, title, excerpt, content, status, published_at, created_at, updated_at")
      .order("published_at", { ascending: false }), "Posts took too long to load.");

    if (error) throw error;
    return data || [];
  }

  async function getPost(slug) {
    if (!configured) return DEMO_POSTS.find((post) => post.slug === slug);

    const data = await restGet(
      "posts",
      {
        select: "id,slug,title,excerpt,content,status,published_at,created_at,updated_at",
        slug: `eq.${slug}`,
        limit: 1
      },
      "Post took too long to load."
    );

    return data[0] || null;
  }

  async function savePost(post) {
    if (!client) throw new Error("Supabase is not configured.");

    const payload = {
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt || null,
      content: post.content || "",
      status: post.status,
      published_at: post.published_at
    };

    if (post.id) {
      const { error } = await client.from("posts").update(payload).eq("id", post.id);
      if (error) throw error;
      return;
    }

    const { error } = await client.from("posts").insert(payload);
    if (error) throw error;
  }

  async function deletePost(id) {
    if (!client) throw new Error("Supabase is not configured.");
    const { error } = await client.from("posts").delete().eq("id", id);
    if (error) throw error;
  }

  async function getSiteSetting(key) {
    if (!configured) return null;
    const data = await restGet(
      "site_settings",
      { key: `eq.${key}`, limit: 1 },
      "Settings took too long to load."
    );
    return data[0]?.value ?? null;
  }

  async function saveSiteSetting(key, value) {
    if (!client) throw new Error("Supabase is not configured.");
    const { error } = await client
      .from("site_settings")
      .upsert({ key, value }, { onConflict: "key" });
    if (error) throw error;
  }

  async function getUser() {
    if (!client) return null;
    const { data } = await withTimeout(
      client.auth.getUser(),
      "Account took too long to load.",
      8000
    );
    return data.user;
  }

  async function getSessionUser() {
    if (!client) return null;
    try {
      const { data } = await withTimeout(
        client.auth.getSession(),
        "Session timed out.",
        5000
      );
      return data.session?.user || null;
    } catch {
      return null;
    }
  }

  async function isBlogAdmin(userId, timeoutMs = 8000) {
    if (!client || !userId) return false;

    const { data, error } = await withTimeout(
      client
        .from("blog_admins")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle(),
      "Admin check took too long.",
      timeoutMs
    );

    if (error) throw error;
    return Boolean(data);
  }

  async function signIn(email, password) {
    if (!client) throw new Error("Add your Supabase anon key in assets/js/config.js.");
    const { error } = await withTimeout(
      client.auth.signInWithPassword({ email, password }),
      "Sign in took too long. Check your connection and try again.",
      12000
    );
    if (error) throw error;
  }

  async function signUp(email, password, displayName) {
    if (!client) throw new Error("Supabase is not configured.");
    const { data, error } = await withTimeout(
      client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: authRedirectUrl(),
          data: { display_name: displayName }
        }
      }),
      "Account creation took too long. Check your connection and try again.",
      12000
    );
    if (error) {
      if (/already|registered|exists/i.test(error.message || "")) {
        throw new Error("An account already exists for this email. Sign in instead.");
      }
      throw error;
    }
    if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
      throw new Error("An account already exists for this email. Sign in instead.");
    }
    if (data.user && data.session) ensureProfile(displayName).catch(() => {});
    return data;
  }

  async function requestPasswordReset(email) {
    if (!client) throw new Error("Supabase is not configured.");
    const { error } = await withTimeout(
      client.auth.resetPasswordForEmail(email, {
        redirectTo: authRecoveryUrl()
      }),
      "Password reset took too long. Check your connection and try again.",
      12000
    );
    if (error) throw error;
  }

  async function signOut() {
    if (!client) return;
    try {
      await withTimeout(
        client.auth.signOut(),
        "Sign out took too long. Check your connection and try again.",
        12000
      );
    } catch (error) {
      // Supabase throws a lock error when an auth state change listener calls
      // getSession() concurrently with signOut(). The session is cleared regardless.
      if (/lock/i.test(error.message || "")) return;
      throw error;
    }
  }

  async function ensureProfile(displayName) {
    const user = await getUser();
    if (!client || !user) return null;

    const existing = await getProfile(user, false);
    if (existing) {
      if (!displayName) return existing;

      const { data, error } = await client
        .from("profiles")
        .update({ display_name: displayName.trim().slice(0, 80) })
        .eq("user_id", user.id)
        .select("user_id, display_name")
        .single();

      if (error) throw error;
      return data;
    }

    const name =
      (displayName || user.user_metadata?.display_name || user.email?.split("@")[0] || "Reader")
        .trim()
        .slice(0, 80);

    const { data, error } = await client
      .from("profiles")
      .insert({ user_id: user.id, display_name: name })
      .select("user_id, display_name")
      .single();

    if (error) throw error;
    return data;
  }

  async function getProfile(user, createIfMissing = true, timeoutMs = 8000) {
    if (!client || !user) return null;

    let result;
    try {
      result = await withTimeout(
        client
          .from("profiles")
          .select("user_id, display_name")
          .eq("user_id", user.id)
          .maybeSingle(),
        "Profile took too long to load.",
        timeoutMs
      );
    } catch {
      return null;
    }

    if (result.error) return null;
    return result.data || (createIfMissing ? ensureProfile() : null);
  }

  async function listComments(postId) {
    if (!configured) return [];

    return restGet(
      "published_comments_with_profiles",
      {
        select: "id,post_id,user_id,body,created_at,display_name",
        post_id: `eq.${postId}`,
        order: "created_at.asc"
      },
      "Comments took too long to load."
    );
  }

  async function listLikes(postId, includeUserIds) {
    if (!configured) return [];

    return restGet(
      "post_likes",
      {
        select: includeUserIds ? "post_id,user_id" : "post_id",
        post_id: `eq.${postId}`
      },
      "Likes took too long to load."
    );
  }

  async function addComment(postId, body) {
    if (!client) throw new Error("Supabase is not configured.");
    await ensureProfile();
    const { error } = await client.from("comments").insert({ post_id: postId, body });
    if (error) throw error;
  }

  async function updateComment(commentId, body) {
    if (!client) throw new Error("Supabase is not configured.");
    const { error } = await client.from("comments").update({ body }).eq("id", commentId);
    if (error) throw error;
  }

  async function deleteComment(commentId) {
    if (!client) throw new Error("Supabase is not configured.");
    const { error } = await client.from("comments").delete().eq("id", commentId);
    if (error) throw error;
  }

  async function toggleLike(postId, liked) {
    if (!client) throw new Error("Supabase is not configured.");
    await ensureProfile();

    const request = liked
      ? client.from("post_likes").delete().eq("post_id", postId)
      : client.from("post_likes").insert({ post_id: postId });

    const { error } = await request;
    if (error) throw error;
  }

  const DEFAULT_ABOUT = "Writer, thinker, occasional builder. I write about ideas that interest me - mostly technology, culture, and the quiet texture of everyday life.";

  async function renderHome() {
    const app = publicApp();
    if (app && !document.getElementById("postList")) {
      app.innerHTML = `
        <h1>Samuel Monty Lewis</h1>
        <p class="about" id="homeAbout">${escapeHtml(DEFAULT_ABOUT)}</p>
        <p class="section-label">Recent Posts</p>
        <ul class="post-list" id="postList">
          <li><p class="empty">Loading...</p></li>
        </ul>
        <a href="${siteUrl("/archive/")}" class="all-posts-link hidden" id="archiveLink">All posts -></a>
        <p class="notice" id="dataNotice"></p>`;
    }

    getSiteSetting("about_text").then((text) => {
      const el = document.getElementById("homeAbout");
      if (el && text) el.textContent = text;
    }).catch(() => {});

    document.title = "Samuel Monty Lewis";
    setActiveNav("home");

    const list = document.getElementById("postList");
    const archiveLink = document.getElementById("archiveLink");
    const notice = document.getElementById("dataNotice");
    if (!list) return;

    try {
      const posts = validPosts(await listPublishedPosts(5));
      if (!posts.length) {
        list.innerHTML = '<li><p class="empty">No posts yet.</p></li>';
        return;
      }

      list.innerHTML = posts
        .map(
          (post) => `
            <li>
              <a href="${postUrl(post)}">${escapeHtml(post.title)}</a>
              <span class="post-meta">${formatDate(post.published_at)}</span>
            </li>`
        )
        .join("");

      if (archiveLink && posts.length >= 5) archiveLink.classList.remove("hidden");
      if (notice && !client) {
        notice.textContent = "Demo content is showing until the Supabase anon key is added.";
      }
    } catch (error) {
      list.innerHTML = `<li><p class="empty">${escapeHtml(error.message)}</p></li>`;
    }
  }

  async function renderAccountPanel(container, onChange) {
    if (!container) return;

    if (!client) {
      container.innerHTML = '<p class="empty">Reader accounts require Supabase.</p>';
      return;
    }

    container.innerHTML = accountAuthMarkup("home");
    wireReaderAuthForm({
      rootId: "homeAuth",
      prefix: "home",
      noticeId: "homeAuthNotice",
      afterAuth: onChange
    });

    let user = null;
    try {
      user = await getSessionUser();
    } catch {
      return;
    }

    if (!user) return;

    const renderSignedInPanel = (profile = null, admin = false) => {
      container.innerHTML = `
        <p class="section-label">${admin ? "Admin Account" : "Reader Account"}</p>
        <p class="reader-status">Signed in as ${escapeHtml(user.email)}${admin ? " / admin" : ""}.</p>
        <form id="profileForm">
          <div class="form-group">
            <label for="profileDisplayName">Display Name</label>
            <input type="text" id="profileDisplayName" maxlength="80" value="${escapeHtml(profile?.display_name || user.user_metadata?.display_name || user.email?.split("@")[0] || "")}" required>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Save</button>
            ${admin ? '<a class="btn" href="admin.html">Dashboard</a>' : ""}
            <button type="button" class="btn" id="homeSignOutBtn">Sign Out</button>
          </div>
        </form>
        <p class="notice" id="homeAuthNotice"></p>`;
      wireAccountPanelActions(onChange);
    };

    renderSignedInPanel();

    Promise.allSettled([
      getProfile(user, false, 2000),
      isBlogAdmin(user.id, 2000)
    ]).then(([profileResult, adminResult]) => {
      if (!container.isConnected || container.classList.contains("hidden")) return;
      const profile = profileResult.status === "fulfilled" ? profileResult.value : null;
      const admin = adminResult.status === "fulfilled" ? adminResult.value : false;
      renderSignedInPanel(profile, admin);
    });
  }

  function wireAccountPanelActions(onChange) {
    const profileForm = document.getElementById("profileForm");
    if (profileForm) {
      profileForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const notice = document.getElementById("homeAuthNotice");
        setNotice(notice, "Saving...");
        try {
          await ensureProfile(document.getElementById("profileDisplayName").value.trim());
          setNotice(notice, "Saved.");
          await onChange();
        } catch (error) {
          setNotice(notice, error.message, true);
        }
      });
    }

    const signOutBtn = document.getElementById("homeSignOutBtn");
    if (signOutBtn) {
      signOutBtn.addEventListener("click", async () => {
        const notice = document.getElementById("homeAuthNotice");
        setNotice(notice, "Signing out...");
        try {
          await signOut();
          await onChange();
        } catch (error) {
          setNotice(notice, error.message, true);
        }
      });
    }
  }

  function accountAuthMarkup(prefix) {
    return `
      <p class="section-label">Account</p>
      <p class="reader-status">Sign in or create an account to like posts and comment.</p>
      <div class="auth-stack" id="${prefix}Auth">
        <form id="${prefix}SignInForm" data-auth-form="signin">
          <div class="form-group">
            <label for="${prefix}SignInEmail">Email</label>
            <input type="email" id="${prefix}SignInEmail" autocomplete="email" required>
          </div>
          <div class="form-group">
            <label for="${prefix}SignInPassword">Password</label>
            <input type="password" id="${prefix}SignInPassword" autocomplete="current-password" required>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Sign In</button>
            <button type="button" class="btn" data-auth-mode="signup">Create Account</button>
          </div>
          <button type="button" class="auth-link" data-auth-reset>Forgot password?</button>
        </form>
        <form id="${prefix}SignUpForm" data-auth-form="signup" class="hidden">
          <div class="form-group">
            <label for="${prefix}SignUpName">Display Name</label>
            <input type="text" id="${prefix}SignUpName" maxlength="80" autocomplete="name" required placeholder="Display name">
          </div>
          <div class="form-group">
            <label for="${prefix}SignUpEmail">Email</label>
            <input type="email" id="${prefix}SignUpEmail" autocomplete="email" required>
          </div>
          <div class="form-group">
            <label for="${prefix}SignUpPassword">Password</label>
            <input type="password" id="${prefix}SignUpPassword" autocomplete="new-password" required>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Create Account</button>
            <button type="button" class="btn" data-auth-mode="signin">Sign In</button>
          </div>
        </form>
        <p class="notice" id="${prefix}AuthNotice"></p>
      </div>`;
  }

  function readerAuthMarkup() {
    return `
      <p class="reader-status">Sign in or create an account to like posts and comment.</p>
      <div class="auth-stack" id="readerAuth">
        <form id="readerSignInForm" data-auth-form="signin">
          <div class="form-group">
            <label for="readerSignInEmail">Email</label>
            <input type="email" id="readerSignInEmail" autocomplete="email" required>
          </div>
          <div class="form-group">
            <label for="readerSignInPassword">Password</label>
            <input type="password" id="readerSignInPassword" autocomplete="current-password" required>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Sign In</button>
            <button type="button" class="btn" data-auth-mode="signup">Create Account</button>
          </div>
          <button type="button" class="auth-link" data-auth-reset>Forgot password?</button>
        </form>
        <form id="readerSignUpForm" data-auth-form="signup" class="hidden">
          <div class="form-group">
            <label for="readerSignUpName">Display Name</label>
            <input type="text" id="readerSignUpName" maxlength="80" autocomplete="name" required placeholder="Display name">
          </div>
          <div class="form-group">
            <label for="readerSignUpEmail">Email</label>
            <input type="email" id="readerSignUpEmail" autocomplete="email" required>
          </div>
          <div class="form-group">
            <label for="readerSignUpPassword">Password</label>
            <input type="password" id="readerSignUpPassword" autocomplete="new-password" required>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Create Account</button>
            <button type="button" class="btn" data-auth-mode="signin">Sign In</button>
          </div>
        </form>
        <p class="notice" id="readerNotice"></p>
      </div>`;
  }

  async function renderNavAccount() {
    const button = document.getElementById("navAccountBtn");
    if (!button) return;

    try {
      if (!client) {
        button.textContent = "Account";
        return;
      }

      const user = await getSessionUser();
      if (!user) {
        button.textContent = "Login / Signup";
        return;
      }

      button.textContent = user.email?.split("@")[0] || "Account";
      getProfile(user, false, 2000).then((profile) => {
        if (profile?.display_name) {
          const freshButton = document.getElementById("navAccountBtn");
          if (freshButton) freshButton.textContent = profile.display_name;
        }
      }).catch(() => {});
    } catch {
      button.textContent = "Login / Signup";
    }
  }

  async function openAccountPopover() {
    let popover = document.getElementById("accountPopover");
    if (popover && !popover.classList.contains("hidden")) {
      closeAccountPopover();
      return;
    }

    if (!popover) {
      popover = document.createElement("div");
      popover.className = "account-popover hidden";
      popover.id = "accountPopover";
      document.body.appendChild(popover);
    }

    const refreshPopover = async () => {
      const fresh = document.getElementById("accountPopover");
      if (fresh) {
        fresh.classList.remove("hidden");
        await renderAccountPanel(fresh, refreshPopover);
      }
      renderNavAccount();
    };

    popover.classList.remove("hidden");
    await renderAccountPanel(popover, refreshPopover);
  }

  function closeAccountPopover() {
    const popover = document.getElementById("accountPopover");
    if (popover) popover.classList.add("hidden");

    if (window.location.hash === "#account") {
      window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
    }
  }

  async function showAccountConfirmationNotice() {
    if (new URLSearchParams(window.location.search).get("account") !== "confirmed") return;
    await openAccountPopover();
    setNotice(
      document.getElementById("homeAuthNotice"),
      "Email confirmed. You can now use your account."
    );
  }

  async function renderReaderAccount(container) {
    return renderAccountPanel(container, () => renderReaderAccount(container));
  }

  async function renderArchive() {
    const app = publicApp();
    if (app && !document.getElementById("archiveContent")) {
      app.innerHTML = `
        <p class="section-label">All Writing</p>
        <h1>Archive</h1>
        <div id="archiveContent"><p class="empty">Loading...</p></div>`;
    }

    document.title = "Archive - Samuel Monty Lewis";
    setActiveNav("archive");

    const container = document.getElementById("archiveContent");
    if (!container) return;

    try {
      const posts = validPosts(await listPublishedPosts());
      if (!posts.length) {
        container.innerHTML = '<p class="empty">No posts yet.</p>';
        return;
      }

      const byYear = posts.reduce((groups, post) => {
        const year = post.published_at.slice(0, 4);
        groups[year] = groups[year] || [];
        groups[year].push(post);
        return groups;
      }, {});

      container.innerHTML = Object.keys(byYear)
        .sort((a, b) => b - a)
        .map(
          (year) => `
            <div class="year-group">
              <p class="year">${year}</p>
              <ul class="post-list archive-list">
                ${byYear[year]
                  .map(
                    (post) => `
                      <li>
                        <a href="${postUrl(post)}">${escapeHtml(post.title)}</a>
                        <span class="post-date">${shortDate(post.published_at)}</span>
                      </li>`
                  )
                  .join("")}
              </ul>
            </div>`
        )
        .join("");
    } catch (error) {
      container.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
    }
  }

  async function renderPost() {
    const app = publicApp();
    if (app && !document.getElementById("content")) {
      app.innerHTML = `
        <a href="${siteUrl("/")}" class="back" data-internal>&lt;- back</a>
        <div id="content"><p class="empty">Loading...</p></div>`;
    }

    setActiveNav("");

    const content = document.getElementById("content");
    if (!content) return;

    const params = new URLSearchParams(window.location.search);
    const path = stripBasePath(window.location.pathname).replace(/\/+$/, "");
    const pathSlug = path.startsWith("/posts/") ? path.split("/")[2] : "";
    const slug = pathSlug || params.get("slug") || params.get("id");
    if (!slug) {
      content.innerHTML = '<p class="empty">Post not found.</p>';
      return;
    }

    try {
      const post = await getPost(slug);
      if (!post) {
        content.innerHTML = '<p class="empty">Post not found.</p>';
        return;
      }

      document.title = `${post.title} - Samuel Monty Lewis`;
      content.innerHTML = `
        <p class="post-date">${formatDate(post.published_at)}</p>
        <h1 class="post-page-title">${escapeHtml(post.title)}</h1>
        <div class="post-body">${renderParagraphs(post.content)}</div>
        <section class="engagement" id="engagement">
          <div class="engagement-header">
            <h2 class="engagement-title">Discussion</h2>
            <button class="btn btn-small" id="likeBtn" type="button">Like</button>
          </div>
          <div class="reader-panel" id="readerPanel"></div>
          <p class="section-label">Comments</p>
          <ul class="comment-list" id="commentList">
            <li><p class="empty">Loading...</p></li>
          </ul>
        </section>`;
      initEngagement(post);
    } catch (error) {
      content.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
    }
  }

  async function initEngagement(post) {
    const panel = document.getElementById("readerPanel");
    const likeBtn = document.getElementById("likeBtn");
    const commentList = document.getElementById("commentList");
    if (!panel || !likeBtn || !commentList) return;

    let editingCommentId = null;
    let confirmingDeleteCommentId = null;
    let commentComposerOpen = false;
    let pendingModerationNotice = "";

    async function refresh() {
      try {
      await ensureCommentModerationLibraryLoaded();
      if (!client) {
        panel.innerHTML = '<p class="empty">Comments and likes require Supabase.</p>';
        commentList.innerHTML = '<li><p class="empty">Unavailable.</p></li>';
        likeBtn.textContent = "Like";
        likeBtn.disabled = true;
        return;
      }

      const user = await getSessionUser().catch(() => null);
      const [profileResult, likesResult, commentsResult, adminResult] = await Promise.allSettled([
        user ? getProfile(user, false, 2000) : Promise.resolve(null),
        listLikes(post.id, Boolean(user)),
        listComments(post.id),
        user ? isBlogAdmin(user.id, 2000) : Promise.resolve(false)
      ]);
      const profile = profileResult.status === "fulfilled" ? profileResult.value : null;
      const likes = likesResult.status === "fulfilled" ? likesResult.value : [];
      const comments = commentsResult.status === "fulfilled" ? commentsResult.value : [];
      const admin = adminResult.status === "fulfilled" ? adminResult.value : false;
      const commentsError = commentsResult.status === "rejected" ? commentsResult.reason : null;
      const liked = Boolean(user && likes.some((like) => like.user_id === user.id));

      likeBtn.textContent = `${liked ? "Liked" : "Like"} (${likes.length})`;
      likeBtn.dataset.liked = liked ? "true" : "false";
      likeBtn.disabled = false;

      panel.innerHTML = user
        ? commentComposerOpen
          ? `
            <p class="reader-status">Signed in as ${escapeHtml(profile?.display_name || user.email)}.</p>
            <form class="comment-form" id="commentForm">
              <div class="form-group">
                <label for="commentBody">Comment</label>
                <textarea id="commentBody" maxlength="2000" required placeholder="Write a comment."></textarea>
              </div>
              <div class="form-actions">
                <button type="submit" class="btn btn-primary">Post Comment</button>
                <button type="button" class="btn" id="cancelCommentComposerBtn">Cancel</button>
              </div>
              <p class="notice" id="readerNotice"></p>
            </form>`
          : `
            <div class="reader-panel-compact">
              <div class="reader-panel-actions">
                <button type="button" class="btn btn-primary" id="openCommentComposerBtn">Add Comment</button>
                <p class="notice" id="readerNotice"></p>
              </div>
            </div>`
        : `
          ${readerAuthMarkup()}`;

      const readerNotice = document.getElementById("readerNotice");
      if (pendingModerationNotice && readerNotice) {
        setNotice(readerNotice, pendingModerationNotice);
        pendingModerationNotice = "";
      }

      commentList.innerHTML = comments.length
        ? comments
            .map(
              (comment) => {
                const moderatedComment = moderateCommentText(comment.body);
                const canEdit = Boolean(user && comment.user_id === user.id);
                const canDelete = Boolean(canEdit || admin);
                const actions = `
                  <div class="comment-actions">
                    ${canEdit ? `<button type="button" class="btn btn-small" data-edit-comment="${escapeHtml(comment.id)}">Edit</button>` : ""}
                    ${canDelete ? `<button type="button" class="btn btn-danger btn-small" data-delete-comment="${escapeHtml(comment.id)}">Delete</button>` : ""}
                  </div>`;

                if (editingCommentId === comment.id) {
                  return `
                    <li>
                      <p class="comment-meta">${escapeHtml(comment.display_name || "Reader")} / ${formatDateTime(comment.created_at)}</p>
                      <textarea class="comment-edit-field" data-comment-edit-body="${escapeHtml(comment.id)}">${escapeHtml(comment.body)}</textarea>
                      <div class="comment-actions">
                        <button type="button" class="btn btn-primary btn-small" data-save-comment="${escapeHtml(comment.id)}">Save</button>
                        <button type="button" class="btn btn-small" data-cancel-comment-edit>Cancel</button>
                      </div>
                    </li>`;
                }

                if (confirmingDeleteCommentId === comment.id) {
                  return `
                    <li>
                      <p class="comment-meta">${escapeHtml(comment.display_name || "Reader")} / ${formatDateTime(comment.created_at)}</p>
                      <p class="comment-body">${escapeHtml(moderatedComment.text)}</p>
                      <div class="inline-confirm">
                        <p>Delete this comment?</p>
                        <div class="comment-actions">
                          <button type="button" class="btn btn-danger btn-small" data-confirm-delete-comment="${escapeHtml(comment.id)}">Delete</button>
                          <button type="button" class="btn btn-small" data-cancel-comment-delete>Cancel</button>
                        </div>
                      </div>
                    </li>`;
                }

                return `
                  <li>
                    <p class="comment-meta">${escapeHtml(comment.display_name || "Reader")} / ${formatDateTime(comment.created_at)}</p>
                    <p class="comment-body">${escapeHtml(moderatedComment.text)}</p>
                    ${canEdit || canDelete ? actions : ""}
                  </li>`;
              }
            )
            .join("")
        : `<li><p class="empty">${commentsError ? escapeHtml(commentsError.message) : "No comments yet."}</p></li>`;

      wireEngagementForm(refresh, {
        onCommentPosted() {
          commentComposerOpen = false;
        },
        setPendingNotice(message) {
          pendingModerationNotice = message;
        }
      });
      wireCommentComposerToggle();
      wireCommentActions();
      } catch (error) {
        panel.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
        commentList.innerHTML = '<li><p class="empty">Comments unavailable.</p></li>';
        likeBtn.disabled = true;
      }
    }

    function wireCommentActions() {
      commentList.onclick = async (event) => {
        const editId = event.target.dataset.editComment;
        const saveId = event.target.dataset.saveComment;
        const deleteId = event.target.dataset.deleteComment;
        const confirmDeleteId = event.target.dataset.confirmDeleteComment;

        if (editId) {
          editingCommentId = editId;
          confirmingDeleteCommentId = null;
          await refresh();
          return;
        }

        if (event.target.dataset.cancelCommentEdit !== undefined) {
          editingCommentId = null;
          await refresh();
          return;
        }

        if (event.target.dataset.cancelCommentDelete !== undefined) {
          confirmingDeleteCommentId = null;
          await refresh();
          return;
        }

        if (saveId) {
          const field = commentList.querySelector(`[data-comment-edit-body="${CSS.escape(saveId)}"]`);
          const body = field ? field.value.trim() : "";
          if (!body) return;

          try {
            pendingModerationNotice = commentModerationNotice(moderateCommentText(body), "Saved");
            await updateComment(saveId, body);
            editingCommentId = null;
            await refresh();
          } catch (error) {
            pendingModerationNotice = "";
            setNotice(document.getElementById("readerNotice"), error.message, true);
          }
          return;
        }

        if (deleteId) {
          confirmingDeleteCommentId = deleteId;
          editingCommentId = null;
          await refresh();
          return;
        }

        if (confirmDeleteId) {
          try {
            await deleteComment(confirmDeleteId);
            confirmingDeleteCommentId = null;
            await refresh();
          } catch (error) {
            setNotice(document.getElementById("readerNotice"), error.message, true);
          }
        }
      };
    }

    function wireCommentComposerToggle() {
      const openBtn = document.getElementById("openCommentComposerBtn");
      if (openBtn) {
        openBtn.addEventListener("click", async () => {
          commentComposerOpen = true;
          await refresh();
          document.getElementById("commentBody")?.focus();
        });
      }

      const cancelBtn = document.getElementById("cancelCommentComposerBtn");
      if (cancelBtn) {
        cancelBtn.addEventListener("click", async () => {
          commentComposerOpen = false;
          await refresh();
        });
      }
    }

    likeBtn.addEventListener("click", async () => {
      const user = await getUser();
      if (!user) {
        const notice = document.getElementById("readerNotice");
        setNotice(notice, "Sign in to like this post.", true);
        return;
      }

      likeBtn.disabled = true;
      try {
        await toggleLike(post.id, likeBtn.dataset.liked === "true");
        await refresh();
      } catch (error) {
        setNotice(document.getElementById("readerNotice"), error.message, true);
        likeBtn.disabled = false;
      }
    });

    window.addEventListener(COMMENT_MODERATION_CHANGE_EVENT, refresh);
    window.addEventListener(COMMENT_MODERATION_LIBRARY_EVENT, refresh);
    window.addEventListener("storage", (event) => {
      if (!event.key || event.key === COMMENT_MODERATION_STORAGE_KEY) refresh();
    });
    if (client) client.auth.onAuthStateChange(() => refresh());
    await refresh();
  }

  function wireReaderAuthForm({ rootId, prefix, noticeId, afterAuth }) {
    const root = document.getElementById(rootId);
    const signInForm = document.getElementById(`${prefix}SignInForm`);
    const signUpForm = document.getElementById(`${prefix}SignUpForm`);
    if (!root || !signInForm || !signUpForm) return;

    const showMode = (mode) => {
      const signingUp = mode === "signup";
      signInForm.classList.toggle("hidden", signingUp);
      signUpForm.classList.toggle("hidden", !signingUp);
      setNotice(document.getElementById(noticeId), "");
    };

    root.querySelectorAll("[data-auth-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        showMode(button.dataset.authMode);
      });
    });

    root.querySelectorAll("[data-auth-reset]").forEach((button) => {
      button.addEventListener("click", async () => {
        const notice = document.getElementById(noticeId);
        const submitButtons = [...root.querySelectorAll("button")];
        const email = document.getElementById(`${prefix}SignInEmail`).value.trim();
        if (!email) {
          setNotice(notice, "Enter your email first, then use forgot password.", true);
          return;
        }

        submitButtons.forEach((item) => {
          item.disabled = true;
        });
        setNotice(notice, "Sending reset email...");
        try {
          await requestPasswordReset(email);
          setNotice(notice, "Check your email for a password reset link.");
        } catch (error) {
          setNotice(notice, error.message, true);
        } finally {
          submitButtons.forEach((item) => {
            item.disabled = false;
          });
        }
      });
    });

    signInForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const notice = document.getElementById(noticeId);
      const submitButtons = [...root.querySelectorAll("button")];
      const email = document.getElementById(`${prefix}SignInEmail`).value.trim();
      const password = document.getElementById(`${prefix}SignInPassword`).value;

      submitButtons.forEach((button) => {
        button.disabled = true;
      });
      setNotice(notice, "Signing in...");
      try {
        await signIn(email, password);
        ensureProfile().catch(() => {});
        await afterAuth();
      } catch (error) {
        setNotice(notice, error.message, true);
      } finally {
        submitButtons.forEach((button) => {
          button.disabled = false;
        });
      }
    });

    signUpForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const notice = document.getElementById(noticeId);
      const submitButtons = [...root.querySelectorAll("button")];
      const displayName = document.getElementById(`${prefix}SignUpName`).value.trim();
      const email = document.getElementById(`${prefix}SignUpEmail`).value.trim();
      const password = document.getElementById(`${prefix}SignUpPassword`).value;

      submitButtons.forEach((button) => {
        button.disabled = true;
      });
      setNotice(notice, "Creating account...");
      try {
        const data = await signUp(email, password, displayName || email.split("@")[0]);
        if (!data.session) {
          showMode("signin");
          setNotice(notice, "Check your email to finish creating this account. Then sign in here.");
          return;
        }
        await afterAuth();
      } catch (error) {
        setNotice(notice, error.message, true);
      } finally {
        submitButtons.forEach((button) => {
          button.disabled = false;
        });
      }
    });
  }

  function wireEngagementForm(refresh, options = {}) {
    const authForm = document.getElementById("readerAuth");
    const commentForm = document.getElementById("commentForm");
    const signOutBtn = document.getElementById("readerSignOutBtn");

    if (authForm) {
      wireReaderAuthForm({
        rootId: "readerAuth",
        prefix: "reader",
        noticeId: "readerNotice",
        afterAuth: refresh
      });
    }

    if (commentForm) {
      commentForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const notice = document.getElementById("readerNotice");
        const body = document.getElementById("commentBody").value.trim();
        if (!body) return;

        setNotice(notice, "Posting...");
        try {
          const path = stripBasePath(window.location.pathname).replace(/\/+$/, "");
          const slug = path.startsWith("/posts/") ? path.split("/")[2] : new URLSearchParams(window.location.search).get("slug");
          const post = await getPost(slug);
          const moderationResult = moderateCommentText(body);
          await addComment(post.id, body);
          if (options.setPendingNotice) {
            options.setPendingNotice(commentModerationNotice(moderationResult, "Posted"));
          } else {
            setNotice(notice, commentModerationNotice(moderationResult, "Posted"));
          }
          if (options.onCommentPosted) options.onCommentPosted();
          await refresh();
        } catch (error) {
          setNotice(notice, error.message, true);
        }
      });
    }

    if (signOutBtn) {
      signOutBtn.addEventListener("click", async () => {
        const notice = document.getElementById("readerNotice");
        setNotice(notice, "Signing out...");
        try {
          await signOut();
          await refresh();
        } catch (error) {
          setNotice(notice, error.message, true);
        }
      });
    }
  }

  async function initAdmin() {
    const authPanel = document.getElementById("authPanel");
    const notAdminPanel = document.getElementById("notAdminPanel");
    const adminPanel = document.getElementById("adminPanel");
    const authForm = document.getElementById("authForm");
    const postForm = document.getElementById("postForm");
    if (!authPanel || !adminPanel || !authForm || !postForm) return;

    let editingPost = null;
    let posts = [];

    function initModerationLab() {
      const slider = document.getElementById("moderationLevel");
      const summary = document.getElementById("moderationSummary");
      const currentLabel = document.getElementById("moderationCurrentLabel");
      const input = document.getElementById("moderationPreviewInput");
      const output = document.getElementById("moderationPreviewOutput");
      const matches = document.getElementById("moderationMatches");
      if (!slider || !summary || !currentLabel || !input || !output || !matches) return;

      const sync = async () => {
        await ensureCommentModerationLibraryLoaded();
        const profile = getCommentModerationProfile();
        const result = moderateCommentText(input.value);
        slider.value = String(profile.value);
        currentLabel.textContent = profile.label;
        summary.textContent = `${profile.description} Saved locally in this browser only.`;
        output.textContent = result.text || "Masked preview will appear here.";
        matches.textContent = result.matches.length
          ? `${result.matches.length} masked ${result.matches.length === 1 ? "segment" : "segments"} in preview.`
          : profile.value === 0
            ? "Masking is currently off."
            : "No masked segments detected in preview.";
      };

      if (!input.value.trim()) {
        input.value = "That was crazzzyyyy shiiiiiiit, but the rest of this comment should stay readable.";
      }

      slider.addEventListener("input", async () => {
        setCommentModerationLevel(slider.value);
        await sync();
      });
      input.addEventListener("input", () => {
        sync().catch(() => {});
      });
      window.addEventListener(COMMENT_MODERATION_CHANGE_EVENT, sync);
      window.addEventListener(COMMENT_MODERATION_LIBRARY_EVENT, sync);
      window.addEventListener("storage", (event) => {
        if (!event.key || event.key === COMMENT_MODERATION_STORAGE_KEY) sync().catch(() => {});
      });
      sync().catch(() => {});
    }

    async function refresh() {
      const user = await getUser();
      const admin = user ? await isBlogAdmin(user.id) : false;

      authPanel.classList.toggle("hidden", Boolean(user));
      notAdminPanel.classList.toggle("hidden", !user || admin);
      adminPanel.classList.toggle("hidden", !admin);
      if (!admin) return;

      posts = await listAllPosts();
      renderStats(posts);
      renderActivityBars(posts);
      renderAdminList(posts);

      getSiteSetting("about_text").then((text) => {
        const field = document.getElementById("aboutField");
        if (field && text !== null) field.value = text;
      }).catch(() => {});
    }

    function renderStats(items) {
      const now = new Date();
      const total = items.length;
      const thisMonth = items.filter((post) => {
        const date = new Date(post.published_at + "T00:00:00");
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }).length;
      const thisYear = items.filter(
        (post) => new Date(post.published_at + "T00:00:00").getFullYear() === now.getFullYear()
      ).length;
      const words = items.reduce((sum, post) => sum + countWords(post.content), 0);
      const latest = sortPosts(items)[0];

      document.getElementById("statTotal").textContent = total;
      document.getElementById("statMonth").textContent = thisMonth;
      document.getElementById("statWords").textContent = words.toLocaleString();
      document.getElementById("statAvg").textContent = total ? Math.round(words / total).toLocaleString() : "0";
      document.getElementById("statYear").textContent = thisYear;
      document.getElementById("statLatest").textContent = latest ? shortDate(latest.published_at) : "-";
    }

    function renderActivityBars(items) {
      const now = new Date();
      const months = [];
      for (let i = 5; i >= 0; i -= 1) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const count = items.filter((post) => {
          const published = new Date(post.published_at + "T00:00:00");
          return published.getMonth() === date.getMonth() && published.getFullYear() === date.getFullYear();
        }).length;
        months.push({
          label: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
          count
        });
      }

      const max = Math.max(...months.map((month) => month.count), 1);
      document.getElementById("activityBars").innerHTML = months
        .map(
          (month) => `
            <div class="bar-row">
              <span class="bar-month">${month.label}</span>
              <div class="bar-track"><div class="bar-fill" style="width:${(month.count / max) * 100}%"></div></div>
              <span class="bar-count">${month.count || ""}</span>
            </div>`
        )
        .join("");
    }

    function renderAdminList(items) {
      const list = document.getElementById("postList");
      if (!items.length) {
        list.innerHTML = '<li><p class="empty">No posts yet.</p></li>';
        return;
      }

      list.innerHTML = items
        .map(
          (post) => `
            <li>
              <div class="post-info">
                <a href="${postUrl(post)}" target="_blank" rel="noopener">${escapeHtml(post.title)}</a>
                <span class="post-meta">${formatDate(post.published_at)} / ${escapeHtml(post.status)}</span>
              </div>
              <div class="post-actions">
                <button class="btn btn-small" data-edit="${escapeHtml(post.id)}" type="button">Edit</button>
                <button class="btn btn-danger btn-small" data-delete="${escapeHtml(post.id)}" type="button">Delete</button>
              </div>
            </li>`
        )
        .join("");
    }

    function clearForm() {
      editingPost = null;
      postForm.reset();
      document.getElementById("date").value = new Date().toISOString().slice(0, 10);
      document.getElementById("status").value = "published";
      document.getElementById("liveWordCount").textContent = "0 words";
      document.getElementById("formTitle").textContent = "Write";
      document.getElementById("cancelBtn").classList.add("hidden");
    }

    function fillForm(post) {
      editingPost = post;
      document.getElementById("title").value = post.title;
      document.getElementById("slug").value = post.slug;
      document.getElementById("date").value = post.published_at;
      document.getElementById("status").value = post.status;
      document.getElementById("excerpt").value = post.excerpt || "";
      document.getElementById("contentField").value = post.content || "";
      document.getElementById("liveWordCount").textContent = `${countWords(post.content)} words`;
      document.getElementById("formTitle").textContent = "Edit Post";
      document.getElementById("cancelBtn").classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    authForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const notice = document.getElementById("authNotice");
      setNotice(notice, "Signing in...");
      try {
        await signIn(document.getElementById("email").value, document.getElementById("password").value);
        authForm.reset();
        setNotice(notice, "");
        await refresh();
      } catch (error) {
        setNotice(notice, error.message, true);
      }
    });

    document.getElementById("resetPasswordBtn")?.addEventListener("click", async () => {
      const notice = document.getElementById("authNotice");
      const email = document.getElementById("email").value.trim();
      if (!email) {
        setNotice(notice, "Enter your email first, then use forgot password.", true);
        return;
      }

      const buttons = [...authForm.querySelectorAll("button")];
      buttons.forEach((button) => {
        button.disabled = true;
      });
      setNotice(notice, "Sending reset email...");
      try {
        await requestPasswordReset(email);
        setNotice(notice, "Check your email for a password reset link.");
      } catch (error) {
        setNotice(notice, error.message, true);
      } finally {
        buttons.forEach((button) => {
          button.disabled = false;
        });
      }
    });

    document.getElementById("signOutBtn").addEventListener("click", async () => {
      await signOut();
      await refresh();
    });

    document.getElementById("notAdminSignOutBtn").addEventListener("click", async () => {
      await signOut();
      await refresh();
    });

    document.getElementById("title").addEventListener("input", (event) => {
      const slugInput = document.getElementById("slug");
      if (!editingPost && !slugInput.dataset.touched) slugInput.value = slugify(event.target.value);
    });

    document.getElementById("slug").addEventListener("input", (event) => {
      event.target.dataset.touched = "true";
      event.target.value = slugify(event.target.value);
    });

    document.getElementById("contentField").addEventListener("input", (event) => {
      const words = countWords(event.target.value);
      document.getElementById("liveWordCount").textContent = `${words} word${words === 1 ? "" : "s"}`;
    });

    document.getElementById("cancelBtn").addEventListener("click", clearForm);

    document.getElementById("postList").addEventListener("click", async (event) => {
      const editId = event.target.dataset.edit;
      const deleteId = event.target.dataset.delete;

      if (editId) {
        const post = posts.find((item) => item.id === editId);
        if (post) fillForm(post);
      }

      if (deleteId && window.confirm("Delete this post?")) {
        try {
          await deletePost(deleteId);
          await refresh();
        } catch (error) {
          setNotice(document.getElementById("postNotice"), error.message, true);
        }
      }
    });

    postForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const notice = document.getElementById("postNotice");
      setNotice(notice, "Saving...");

      const title = document.getElementById("title").value.trim();
      const slug = slugify(document.getElementById("slug").value || title);
      const publishedAt = document.getElementById("date").value;
      const status = document.getElementById("status").value;
      const excerpt = document.getElementById("excerpt").value.trim();
      const content = document.getElementById("contentField").value.trim();

      if (!title || !slug || !publishedAt || !content) {
        setNotice(notice, "Title, slug, date, and content are required.", true);
        return;
      }

      try {
        await savePost({
          id: editingPost ? editingPost.id : null,
          title,
          slug,
          published_at: publishedAt,
          status,
          excerpt,
          content
        });
        clearForm();
        setNotice(notice, "Saved.");
        await refresh();
      } catch (error) {
        setNotice(notice, error.message, true);
      }
    });

    document.getElementById("aboutForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const notice = document.getElementById("aboutNotice");
      setNotice(notice, "Saving...");
      try {
        await saveSiteSetting("about_text", document.getElementById("aboutField").value.trim());
        setNotice(notice, "Saved.");
      } catch (error) {
        setNotice(notice, error.message, true);
      }
    });

    clearForm();
    initModerationLab();
    if (!configured) {
      setNotice(
        document.getElementById("authNotice"),
        "Add your Supabase anon key in assets/js/config.js before using admin.",
        true
      );
    }
    await refresh();
  }

  async function renderNotFound() {
    setActiveNav("");
    document.title = "Not found - Samuel Monty Lewis";
    const app = publicApp();
    if (app) {
      app.innerHTML = `
        <a href="${siteUrl("/")}" class="back" data-internal>&lt;- back</a>
        <p class="empty">Page not found.</p>`;
    }
  }

  async function routePublicSite() {
    renderNavAccount();
    const pathname = stripBasePath(window.location.pathname).replace(/\/+$/, "") || "/";

    if (pathname === "/" || pathname === "/index.html") {
      if (pathname === "/index.html") {
        window.history.replaceState({}, "", siteUrl("/"));
      }
      await renderHome();
      return;
    }

    if (pathname === "/archive" || pathname === "/archive.html") {
      if (pathname === "/archive.html") {
        window.history.replaceState({}, "", siteUrl("/archive/"));
      }
      await renderArchive();
      return;
    }

    if (pathname === "/post.html" || pathname.startsWith("/posts/")) {
      if (pathname === "/post.html") {
        const slug = new URLSearchParams(window.location.search).get("slug");
        if (slug) window.history.replaceState({}, "", siteUrl(`/posts/${encodeURIComponent(slug)}/`));
      }
      await renderPost();
      return;
    }

    await renderNotFound();
  }

  function initPublicSite() {
    document.querySelectorAll("[data-href]").forEach((element) => {
      element.setAttribute("href", siteUrl(element.dataset.href));
    });

    document.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("#navAccountBtn")) {
        event.preventDefault();
        openAccountPopover();
        return;
      }

      const popover = document.getElementById("accountPopover");
      if (
        popover &&
        !popover.classList.contains("hidden") &&
        event.target instanceof Element &&
        !event.target.closest("#accountPopover")
      ) {
        closeAccountPopover();
      }

      const link = event.target.closest("a");
      if (!link) return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || !url.pathname.startsWith(config.basePath || "/")) {
        return;
      }

      if (link.target || link.hasAttribute("download")) return;

      const routePath = stripBasePath(url.pathname);
      const isPublicRoute =
        routePath === "/" ||
        routePath === "/index.html" ||
        routePath === "/archive/" ||
        routePath === "/archive" ||
        routePath.startsWith("/posts/");

      if (!isPublicRoute) return;

      event.preventDefault();
      window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
      routePublicSite();
    });

    window.addEventListener("popstate", routePublicSite);
    if (client) client.auth.onAuthStateChange((_event, session) => {
      const button = document.getElementById("navAccountBtn");
      if (!button) return;
      const user = session?.user || null;
      button.textContent = user ? user.email?.split("@")[0] || "Account" : "Login / Signup";
      if (user) {
        getProfile(user, false).then((profile) => {
          if (profile?.display_name) {
            const btn = document.getElementById("navAccountBtn");
            if (btn) btn.textContent = profile.display_name;
          }
        }).catch(() => {});
      }
    });
    window.addEventListener("hashchange", () => {
      if (window.location.hash === "#account") openAccountPopover();
    });
    routePublicSite();
    window.setTimeout(showAccountConfirmationNotice, 0);
    if (window.location.hash === "#account") window.setTimeout(openAccountPopover, 0);
  }

  async function initResetPassword() {
    const form = document.getElementById("resetPasswordForm");
    const passwordField = document.getElementById("resetPassword");
    const confirmField = document.getElementById("resetPasswordConfirm");
    const notice = document.getElementById("resetPasswordNotice");
    const intro = document.getElementById("resetPasswordIntro");
    const successPanel = document.getElementById("resetPasswordSuccess");
    if (!form || !passwordField || !confirmField || !notice) return;

    if (!client) {
      setNotice(notice, "Supabase is not configured.", true);
      return;
    }

    const syncState = async () => {
      const hashParams = readHashParams();
      const hashErrorCode = hashParams.get("error_code");
      const hashErrorDescription = hashParams.get("error_description");
      if (hashErrorCode) {
        form.classList.add("hidden");
        if (successPanel) successPanel.classList.add("hidden");
        if (intro) {
          intro.textContent = hashErrorCode === "otp_expired"
            ? "This password reset link has expired or has already been used."
            : "This password reset link could not be used.";
        }
        setNotice(
          notice,
          hashErrorCode === "otp_expired"
            ? "This reset link is no longer valid. Request a new password reset email and use the newest link."
            : (hashErrorDescription || "Password reset failed."),
          true
        );
        return;
      }

      const { data } = await client.auth.getSession();
      const hasSession = Boolean(data.session);
      form.classList.toggle("hidden", !hasSession);
      if (intro) {
        intro.textContent = hasSession
          ? "Enter a new password for your account."
          : "Open this page from the password reset link in your email.";
      }
      if (!hasSession) {
        setNotice(notice, "Password reset link required.", true);
      } else if (!successPanel || successPanel.classList.contains("hidden")) {
        setNotice(notice, "");
      }
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = passwordField.value;
      const confirmPassword = confirmField.value;

      if (password.length < 8) {
        setNotice(notice, "Use at least 8 characters.", true);
        return;
      }
      if (password !== confirmPassword) {
        setNotice(notice, "Passwords do not match.", true);
        return;
      }

      const buttons = [...form.querySelectorAll("button")];
      buttons.forEach((button) => {
        button.disabled = true;
      });
      setNotice(notice, "Saving new password...");
      try {
        const { error } = await withTimeout(
          client.auth.updateUser({ password }),
          "Password update took too long. Check your connection and try again.",
          12000
        );
        if (error) throw error;
        form.reset();
        form.classList.add("hidden");
        if (successPanel) successPanel.classList.remove("hidden");
        setNotice(notice, "");
        window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
      } catch (error) {
        setNotice(notice, error.message, true);
      } finally {
        buttons.forEach((button) => {
          button.disabled = false;
        });
      }
    });

    if (client) client.auth.onAuthStateChange(() => syncState());
    await syncState();
  }

  window.SMLBlog = {
    initPublicSite,
    renderNavAccount,
    renderHome,
    renderArchive,
    renderPost,
    initAdmin,
    initResetPassword
  };
})();
