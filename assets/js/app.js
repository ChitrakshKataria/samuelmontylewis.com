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
    basePath: (window.SML_BASE_PATH || "").replace(/\/$/, "")
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

  function shortDate(date) {
    return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
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

  function setNotice(element, message, isError) {
    if (!element) return;
    element.textContent = message || "";
    element.classList.toggle("error", Boolean(isError));
  }

  async function listPublishedPosts(limit) {
    if (!client) return sortPosts(DEMO_POSTS).slice(0, limit || DEMO_POSTS.length);

    let query = client
      .from("posts")
      .select("id, slug, title, excerpt, content, status, published_at, created_at, updated_at")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function listAllPosts() {
    if (!client) return sortPosts(DEMO_POSTS);
    const { data, error } = await client
      .from("posts")
      .select("id, slug, title, excerpt, content, status, published_at, created_at, updated_at")
      .order("published_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async function getPost(slug) {
    if (!client) return DEMO_POSTS.find((post) => post.slug === slug);

    const { data, error } = await client
      .from("posts")
      .select("id, slug, title, excerpt, content, status, published_at, created_at, updated_at")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw error;
    return data;
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

  async function getUser() {
    if (!client) return null;
    const { data } = await client.auth.getUser();
    return data.user;
  }

  async function isBlogAdmin(userId) {
    if (!client || !userId) return false;

    const { data, error } = await client
      .from("blog_admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  }

  async function signIn(email, password) {
    if (!client) throw new Error("Add your Supabase anon key in assets/js/config.js.");
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
  }

  async function renderHome() {
    const app = publicApp();
    if (app && !document.getElementById("postList")) {
      app.innerHTML = `
        <h1>Samuel Monty Lewis</h1>
        <p class="about">
          Writer, thinker, occasional builder. I write about ideas that interest me - mostly technology, culture, and the quiet texture of everyday life.
        </p>
        <p class="section-label">Recent Posts</p>
        <ul class="post-list" id="postList">
          <li><p class="empty">Loading...</p></li>
        </ul>
        <a href="${siteUrl("/archive/")}" class="all-posts-link hidden" id="archiveLink">All posts -></a>
        <p class="notice" id="dataNotice"></p>`;
    }

    document.title = "Samuel Monty Lewis";
    setActiveNav("home");

    const list = document.getElementById("postList");
    const archiveLink = document.getElementById("archiveLink");
    const notice = document.getElementById("dataNotice");
    if (!list) return;

    try {
      const posts = await listPublishedPosts(5);
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
      const posts = await listPublishedPosts();
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
        <div class="post-body">${renderParagraphs(post.content)}</div>`;
    } catch (error) {
      content.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
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

    clearForm();
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
    routePublicSite();
  }

  window.SMLBlog = {
    initPublicSite,
    renderHome,
    renderArchive,
    renderPost,
    initAdmin
  };
})();
