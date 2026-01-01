//static/script.js
document.addEventListener("DOMContentLoaded", () => {
  const movieContainer = document.getElementById("movie-results");
  const reviewContainer = document.getElementById("review-history");

  const searchInput = document.getElementById("global-search");
  const reviewInput = document.getElementById("review-text");
  const micSearchBtn = document.getElementById("mic-search");
  const micReviewBtn = document.getElementById("mic-review");

  const toggleBtn = document.getElementById("toggle-filters");
  const filtersSection = document.getElementById("filters-section");
  const darkModeToggle = document.getElementById("toggle-dark-mode");

  // Dark Mode Logic
  if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark-mode");
    darkModeToggle.textContent = "☀️";
  }

  darkModeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("darkMode", isDark);
    darkModeToggle.textContent = isDark ? "☀️" : "🌙";
  });

  let currentPage = 1;
  let lastFetchType = "search"; // 'search' | 'filter' | 'recommendation'
  let lastFetchParams = {};

  // Create pagination container
  const paginationDiv = document.createElement("div");
  paginationDiv.id = "pagination-controls";
  paginationDiv.className = "pagination-row";

  if (movieContainer) {
    movieContainer.parentNode.insertBefore(paginationDiv, movieContainer.nextSibling);
  }

  function updatePaginationUI(resultCount) {
    paginationDiv.innerHTML = "";
    if (lastFetchType === "recommendation") return; // No pagination for recs yet

    const prevBtn = document.createElement("button");
    prevBtn.textContent = "Previous";
    prevBtn.disabled = currentPage <= 1;
    prevBtn.onclick = () => changePage(-1);

    const nextBtn = document.createElement("button");
    nextBtn.textContent = "Next";
    // Simple heuristic: if we got fewer than 20 results, likely no next page
    if (resultCount < 20) nextBtn.disabled = true;
    nextBtn.onclick = () => changePage(1);

    const pageInfo = document.createElement("span");
    pageInfo.textContent = ` Page ${currentPage} `;
    pageInfo.style.margin = "0 10px";

    paginationDiv.append(prevBtn, pageInfo, nextBtn);
  }

  function changePage(delta) {
    currentPage += delta;
    if (currentPage < 1) currentPage = 1;

    if (lastFetchType === "search") {
      fetchMovies(lastFetchParams.query, currentPage);
    } else if (lastFetchType === "filter") {
      // Construct URL from params
      const { genre, year, rating } = lastFetchParams;
      const q = lastFetchParams.q || "";
      fetch(`/filter_movies?genre=${encodeURIComponent(genre)}&year=${encodeURIComponent(year)}&rating=${encodeURIComponent(rating)}&q=${encodeURIComponent(q)}&page=${currentPage}`)
        .then(r => r.json()).then(displayMovies).catch(console.error);
    }
  }

  // ==========================
  // UTILITY FUNCTIONS
  // ==========================
  function isMobileOrTablet() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"'`=\/]/g, function (c) {
      return {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
        "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
      }[c];
    });
  }

  function handleResponsiveFilters() {
    if (!filtersSection) return; // Exit if filters don't exist (e.g. on search page)

    if (window.innerWidth > 768) {
      filtersSection.style.display = "block";
      if (toggleBtn) toggleBtn.style.display = "none";
    } else {
      filtersSection.style.display = "none";
      if (toggleBtn) toggleBtn.style.display = "block";
      if (toggleBtn) toggleBtn.textContent = "Show Filters";
    }
  }

  if (toggleBtn && filtersSection) {
    toggleBtn.addEventListener("click", () => {
      if (filtersSection.style.display === "block") {
        filtersSection.style.display = "none";
        toggleBtn.textContent = "Show Filters";
      } else {
        filtersSection.style.display = "block";
        toggleBtn.textContent = "Hide Filters";
      }
    });
  }

  window.addEventListener("resize", handleResponsiveFilters);
  window.addEventListener("load", handleResponsiveFilters);

  // ==========================
  // SPEECH-TO-TEXT
  // ==========================
  function startSpeechToText(inputField) {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.start();
    recognition.onresult = (event) => {
      inputField.value += event.results[0][0].transcript;
    };
    recognition.onerror = (event) => console.error("Speech recognition error:", event.error);
  }

  micSearchBtn.addEventListener("click", () => startSpeechToText(searchInput));
  micReviewBtn.addEventListener("click", () => startSpeechToText(reviewInput));

  // HOTWORD ACTIVATION: "OKAY BUDDY"
  if (isMobileOrTablet() && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const hotwordRecog = new SpeechRecognition();
    hotwordRecog.continuous = true;
    hotwordRecog.lang = 'en-US';

    hotwordRecog.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim();
      if (/^okay buddy$/i.test(transcript)) startSpeechToText(searchInput);
    };
    hotwordRecog.onerror = (event) => console.error("Hotword recognition error:", event.error);
    hotwordRecog.onend = () => hotwordRecog.start();
    hotwordRecog.start();
  }

  // ==========================
  // MOVIES
  // ==========================
  const knownGenres = [
    "action", "adventure", "animation", "comedy", "crime", "documentary",
    "drama", "family", "fantasy", "history", "horror", "music",
    "mystery", "romance", "science fiction", "sci-fi", "tv movie",
    "thriller", "war", "western"
  ];

  function showLoading() {
    if (movieContainer) {
      movieContainer.innerHTML = '<div class="spinner"></div>';
    }
  }

  function displayMovies(movies) {
    movieContainer.innerHTML = "";
    if (!movies || movies.length === 0) {
      movieContainer.innerHTML = "<p>No movies found.</p>";
      return;
    }
    movies.forEach(m => {
      const card = document.createElement("div");
      card.className = "movie-card";
      const title = m.title || m.name || "Untitled";
      const posterPath = m.poster_path ? `https://image.tmdb.org/t/p/w200${m.poster_path}` : "";
      const rating = m.vote_average || "N/A";
      const year = (m.release_date || m.first_air_date || "").slice(0, 4) || "—";
      const ytId = m.youtube_id || "dQw4w9WgXcQ";

      const detailsUrl = `/movie/${m.id}`;

      card.innerHTML = `
        <a href="${detailsUrl}" style="text-decoration: none; color: inherit; display: block;">
            <div class="poster">
                <img src="${posterPath}" onerror="this.style.display='none'">
            </div>
            <div class="info">
                <h3 class="movie-title">${title}</h3>
                <p>Year: ${year} • Rating: ${rating}</p>
                <p class="overview">${m.overview || ""}</p>
            </div>
        </a>
        <div class="actions">
             <a href="${detailsUrl}" class="btn btn-secondary" style="width: 100%;">Details</a>
        </div>
      `;
      movieContainer.appendChild(card);
      // Removed btn-trailer listener logic

      // Add Similar Movies button
      const similarBtn = document.createElement("button");
      similarBtn.textContent = "Similar Movies";
      similarBtn.className = "btn btn-primary btn-similar";
      similarBtn.style.marginTop = "8px";
      similarBtn.style.width = "100%";
      similarBtn.addEventListener("click", () => fetchRecommendations(m.id));
      card.querySelector(".actions").appendChild(similarBtn);
    });
    updatePaginationUI(movies.length);
  }

  function fetchRecommendations(movieId) {
    lastFetchType = "recommendation";
    fetch(`/recommendations/${movieId}`)
      .then(r => r.json())
      .then(displayMovies)
      .catch(console.error);
  }


  function fetchMovies(query = "", page = 1) {
    showLoading();
    currentPage = page;
    if (page === 1) {
      lastFetchType = "search";
      lastFetchParams = { query };
    }

    if (!query) {
      return fetch(`/search_tmdb?page=${page}`)
        .then(r => {
          if (!r.ok) throw new Error("Network response was not ok");
          return r.json();
        })
        .then(displayMovies)
        .catch(err => {
          console.error(err);
          if (movieContainer) movieContainer.innerHTML = `<p style="text-align:center; padding: 20px; color: red;">Error loading movies: ${err.message}</p>`;
        });
    }
    const lower = query.toLowerCase();
    // Simplified: always use search endpoint for queries, filter logic handled separately or via generic search
    fetch(`/search_tmdb?q=${encodeURIComponent(query)}&page=${page}`)
      .then(r => {
        if (!r.ok) throw new Error("Network response was not ok");
        return r.json();
      })
      .then(displayMovies)
      .catch(err => {
        console.error(err);
        if (movieContainer) movieContainer.innerHTML = `<p style="text-align:center; padding: 20px; color: red;">Error searching movies: ${err.message}</p>`;
      });
  }

  document.getElementById("btn-search").addEventListener("click", () => {
    fetchMovies(searchInput.value.trim());
  });

  const applyMovieFiltersBtn = document.getElementById("apply-movie-filters");
  if (applyMovieFiltersBtn) {
    applyMovieFiltersBtn.addEventListener("click", () => {
      currentPage = 1;
      lastFetchType = "filter";

      const genre = document.getElementById("filter-genre").value;
      const year = document.getElementById("filter-year").value;
      const rating = document.getElementById("filter-rating").value;
      const q = "";

      lastFetchParams = { genre, year, rating, q };

      fetch(`/filter_movies?genre=${encodeURIComponent(genre)}&year=${encodeURIComponent(year)}&rating=${encodeURIComponent(rating)}&page=${currentPage}`)
        .then(r => r.json()).then(displayMovies).catch(console.error);
    });
  }

  // ==========================
  // REVIEWS
  // ==========================
  function displayReviews(reviews) {
    reviewContainer.innerHTML = "";
    if (!reviews || reviews.length === 0) {
      reviewContainer.innerHTML = "<p>No reviews yet.</p>";
      return;
    }
    reviews.forEach(r => {
      const wrapper = document.createElement("div");
      wrapper.className = "review-item";
      wrapper.innerHTML = `
        <div class="r-head"><strong>${escapeHtml(r.movie_title)}</strong>
          <span class="meta">${r.sentiment_label} • ${r.word_count} words • ${r.date_created}</span>
        </div>
        <p class="r-text">${escapeHtml(r.review_text)}</p>
        <button class="btn btn-danger btn-delete" data-id="${r.id}" style="float: right;">Delete</button>
      `;
      reviewContainer.appendChild(wrapper);

      wrapper.querySelector(".btn-delete").addEventListener("click", () => {
        if (confirm("Delete this review?")) {
          fetch(`/delete_review/${r.id}`, { method: "DELETE" })
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                loadReviews();
                loadAnalytics();
              } else {
                alert("Error deleting review: " + data.error);
              }
            });
        }
      });
    });
  }

  function loadReviews() {
    fetch("/filter_reviews").then(r => r.json()).then(displayReviews).catch(console.error);
  }

  document.getElementById("btn-add-review").addEventListener("click", () => {
    const title = document.getElementById("review-movie-title").value.trim() || "Unknown";
    const text = document.getElementById("review-text").value.trim();
    if (!text) return alert("Write a review first.");

    fetch("/add_review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movie_title: title, review_text: text })
    })
      .then(r => r.json())
      .then(() => {
        loadReviews();
        document.getElementById("review-text").value = "";
        document.getElementById("review-movie-title").value = "";
        loadAnalytics(); // Refresh analytics
      }).catch(console.error);
  });

  // ==========================
  // ANALYTICS
  // ==========================
  let sentimentChart = null;

  function loadAnalytics() {
    // 1. Sentiment Chart
    fetch("/api/stats")
      .then(r => r.json())
      .then(stats => {
        const ctx = document.getElementById("sentiment-chart").getContext("2d");
        const data = [stats.positive, stats.neutral, stats.negative];

        if (sentimentChart) {
          sentimentChart.data.datasets[0].data = data;
          sentimentChart.update();
        } else {
          sentimentChart = new Chart(ctx, {
            type: 'pie',
            data: {
              labels: ['Positive', 'Neutral', 'Negative'],
              datasets: [{
                data: data,
                backgroundColor: ['#4CAF50', '#FFC107', '#F44336']
              }]
            },
            options: {
              responsive: true,
              plugins: {
                legend: { position: 'bottom' }
              }
            }
          });
        }
      })
      .catch(console.error);

    // 2. Word Cloud
    // Just set the src with a timestamp to force refresh
    const img = document.getElementById("wordcloud-img");
    if (img) img.src = "/api/wordcloud?t=" + new Date().getTime();
  }

  // ==========================
  // INITIAL LOAD
  // ==========================
  loadReviews();
  loadAnalytics();

  // CHECK FOR DETAILS PAGE ELEMENTS
  const detailTitleInput = document.getElementById("detail-movie-title");
  const detailReviewText = document.getElementById("detail-review-text");
  const detailAddBtn = document.getElementById("btn-detail-add-review");
  const detailChart = document.getElementById("detail-sentiment-chart");
  const detailCloud = document.getElementById("detail-wordcloud-img");

  if (detailTitleInput && detailChart) {
    // We are on details page
    const movieTitle = detailTitleInput.value;
    loadDetailAnalytics(movieTitle);

    // Detail add button listener removed from here (moved to end of file)
  }

  // ==========================
  // WATCHLIST LOGIC (Independent)
  // ==========================
  const watchlistBtn = document.getElementById("btn-watchlist");
  if (watchlistBtn) {
    console.log("Watchlist button found, initializing...");
    const movieId = watchlistBtn.dataset.id;

    // Check if in watchlist
    fetch(`/api/watchlist/check/${movieId}`)
      .then(r => r.json())
      .then(data => {
        if (data.in_watchlist) {
          setWatchlistButtonState(true);
        }
      })
      .catch(err => console.error("Error checking watchlist:", err));

    watchlistBtn.addEventListener("click", (e) => {
      if (typeof window.IS_LOGGED_IN !== 'undefined' && !window.IS_LOGGED_IN) {
        window.location.href = '/login';
        return;
      }

      const isSaved = watchlistBtn.classList.contains("saved");
      console.log("Watchlist clicked. Current state saved:", isSaved);
      // alert("Heart clicked! Processing..."); 

      if (isSaved) {
        // Remove
        fetch(`/api/watchlist/remove/${movieId}`, { method: "DELETE" })
          .then(r => r.json())
          .then(res => {
            if (res.success) setWatchlistButtonState(false);
            else alert("Error removing: " + res.error);
          })
          .catch(err => alert("Network error removing: " + err));
      } else {
        // Add
        const payload = {
          id: movieId,
          title: watchlistBtn.dataset.title,
          poster_path: watchlistBtn.dataset.poster,
          release_date: watchlistBtn.dataset.date,
          vote_average: watchlistBtn.dataset.rating
        };
        fetch("/api/watchlist/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).then(r => r.json())
          .then(res => {
            if (res.success) setWatchlistButtonState(true);
            else alert("Failed to add: " + (res.error || "Unknown error"));
          })
          .catch(err => alert("Network error adding: " + err));
      }
    });

    function setWatchlistButtonState(saved) {
      if (saved) {
        watchlistBtn.innerHTML = "❤️"; // Red Heart
        watchlistBtn.style.transform = "scale(1.2)";
        watchlistBtn.classList.add("saved");
      } else {
        watchlistBtn.innerHTML = "🤍"; // White Heart
        watchlistBtn.style.transform = "scale(1)";
        watchlistBtn.classList.remove("saved");
      }
    }
  }

  // ==========================
  // Enforce Auth for Actions
  // ==========================
  function requireLogin(e) {
    console.log("requireLogin called. IS_LOGGED_IN:", typeof window.IS_LOGGED_IN !== 'undefined' ? window.IS_LOGGED_IN : 'undefined');
    if (typeof window.IS_LOGGED_IN !== 'undefined' && !window.IS_LOGGED_IN) {
      console.log("Redirecting to login...");
      e.preventDefault();
      window.location.href = '/login';
      return false;
    }
    return true;
  }

  // Official Download Button
  const downloadBtn = document.getElementById("btn-official-download");
  if (downloadBtn) {
    console.log("Download button found. Attaching listener. IS_LOGGED_IN =", typeof window.IS_LOGGED_IN !== 'undefined' ? window.IS_LOGGED_IN : 'undefined');
    downloadBtn.addEventListener("click", requireLogin);
  } else {
    console.log("Download button NOT found.");
  }

  // Review & Analytics
  if (detailAddBtn) {
    detailAddBtn.addEventListener("click", (e) => {
      if (!requireLogin(e)) return;

      const text = detailReviewText.value.trim();
      if (!text) return alert("Please write a review.");

      fetch("/add_review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movie_title: detailTitleInput.value, review_text: text })
      })
        .then(r => r.json())
        .then(() => {
          detailReviewText.value = "";
          // Reload page to show new review and updated stats
          window.location.reload();
        })
        .catch(console.error);
    });
  }


  function loadDetailAnalytics(title) {
    const ctx = document.getElementById("detail-sentiment-chart").getContext("2d");
    // Ensure we send movie_title to API
    fetch(`/api/stats?movie_title=${encodeURIComponent(title)}`)
      .then(r => r.json())
      .then(stats => {
        new Chart(ctx, {
          type: 'pie',
          data: {
            labels: ['Positive', 'Neutral', 'Negative'],
            datasets: [{
              data: [stats.positive, stats.neutral, stats.negative],
              backgroundColor: ['#28a745', '#ffc107', '#dc3545']
            }]
          },
          options: { responsive: true }
        });
      })
      .catch(console.error);

    // Load wordcloud for this movie
    if (detailCloud) {
      detailCloud.src = `/api/wordcloud?movie_title=${encodeURIComponent(title)}&t=` + new Date().getTime();
    }
  }

  // Check URL params for search query (from Landing -> Search page)
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q");
  if (q && document.getElementById("global-search")) {
    document.getElementById("global-search").value = q;
    fetchMovies(q);
  } else if (typeof fetchMovies === "function" && document.getElementById("global-search")) {
    // Only call fetchMovies if we are on the main browse/search page
    fetchMovies();
  }
});
