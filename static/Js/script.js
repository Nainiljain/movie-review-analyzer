// static/script.js
// static/script.js
document.addEventListener("DOMContentLoaded", () => {

  const movieContainer = document.getElementById("movie-results");
  const reviewContainer = document.getElementById("review-history");

  // ==========================
  // UTILITY: Mobile/Tablet check
  // ==========================
  function isMobileOrTablet() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  // ==========================
  // MOBILE FILTER TOGGLE
  // ==========================
  const toggleBtn = document.getElementById('toggle-filters');
  const filtersSection = document.getElementById('filters-section');

  function toggleFilters() {
    if (filtersSection.style.display === 'block') {
      filtersSection.style.display = 'none';
      toggleBtn.textContent = 'Show Filters';
    } else {
      filtersSection.style.display = 'block';
      toggleBtn.textContent = 'Hide Filters';
    }
  }

  toggleBtn.addEventListener('click', toggleFilters);

  function handleResponsiveFilters() {
    if (window.innerWidth > 768) {
      filtersSection.style.display = 'block';
      toggleBtn.style.display = 'none';
    } else {
      filtersSection.style.display = 'none';
      toggleBtn.style.display = 'block';
      toggleBtn.textContent = 'Show Filters';
    }
  }

  // Call on load and resize
  window.addEventListener('resize', handleResponsiveFilters);
  window.addEventListener('load', handleResponsiveFilters);

  // Call after dynamic content load
  function refreshFiltersState() {
    handleResponsiveFilters();
  }

  // ==========================
  // SPEECH-TO-TEXT MICS
  // ==========================
  const micSearchBtn = document.getElementById('mic-search');
  const searchInput = document.getElementById('global-search');
  const micReviewBtn = document.getElementById('mic-review');
  const reviewInput = document.getElementById('review-text');

  function startSpeechToText(inputField) {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const tempRecog = new SpeechRecognition();
    tempRecog.continuous = false;
    tempRecog.lang = 'en-US';
    tempRecog.start();
    tempRecog.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      inputField.value += transcript;
    };
    tempRecog.onerror = (event) => console.error("Speech recognition error:", event.error);
  }

  micSearchBtn.addEventListener('click', () => startSpeechToText(searchInput));
  micReviewBtn.addEventListener('click', () => startSpeechToText(reviewInput));

  // ==========================
  // HOTWORD "OKAY BUDDY"
  // ==========================
  if (isMobileOrTablet() && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const hotwordRecog = new SpeechRecognition();
    hotwordRecog.continuous = true;
    hotwordRecog.lang = 'en-US';

    hotwordRecog.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim();
      if (/^okay buddy$/i.test(transcript)) {
        console.log("Hotword detected! Activating search mic...");
        startSpeechToText(searchInput);
      }
    };

    hotwordRecog.onerror = (event) => console.error("Hotword recognition error:", event.error);
    hotwordRecog.onend = () => {
      if (isMobileOrTablet()) hotwordRecog.start();
    };

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

  function loadMovies() {
    fetch("/search_tmdb")
      .then(r => r.json())
      .then(movies => {
        displayMovies(movies);
        refreshFiltersState();
      })
      .catch(console.error);
  }

  function fetchMovies(query) {
    if (!query) {
      loadMovies();
      return;
    }

    const lower = query.toLowerCase();
    if (knownGenres.includes(lower)) {
      fetch(`/filter_movies?genre=${encodeURIComponent(lower)}`)
        .then(r => r.json())
        .then(movies => {
          displayMovies(movies);
          refreshFiltersState();
        })
        .catch(console.error);
    } else {
      fetch(`/search_tmdb?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(movies => {
          displayMovies(movies);
          refreshFiltersState();
        })
        .catch(console.error);
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
      const year = (m.release_date || m.first_air_date || "").slice(0,4) || "—";
      const ytId = m.youtube_id || "dQw4w9WgXcQ";

      card.innerHTML = `
        <div class="poster"><img src="${posterPath}" onerror="this.style.display='none'"></div>
        <div class="info">
          <h3 class="movie-title">${title}</h3>
          <p>Year: ${year} • Rating: ${rating}</p>
          <p class="overview">${m.overview || ""}</p>
          <div class="actions">
            <button class="btn-trailer" data-yt="${ytId}">Play Trailer</button>
          </div>
        </div>
      `;

      movieContainer.appendChild(card);

      const btn = card.querySelector(".btn-trailer");
      btn.addEventListener("click", () => {
        const w = window.open(`https://www.youtube.com/watch?v=${btn.dataset.yt}`, "_blank");
        if (!w) alert("Popup blocked — open manually: https://youtube.com/watch?v=" + btn.dataset.yt);
      });
    });
  }

  document.getElementById("btn-search").addEventListener("click", () => {
    const q = searchInput.value.trim();
    fetchMovies(q);
  });

  document.getElementById("apply-movie-filters").addEventListener("click", () => {
    const genre = document.getElementById("filter-genre").value;
    const year = document.getElementById("filter-year").value;
    const rating = document.getElementById("filter-rating").value;
    fetch(`/filter_movies?genre=${encodeURIComponent(genre)}&year=${encodeURIComponent(year)}&rating=${encodeURIComponent(rating)}`)
      .then(r => r.json())
      .then(movies => {
        displayMovies(movies);
        refreshFiltersState();
      })
      .catch(console.error);
  });

  // ==========================
  // REVIEWS
  // ==========================
  function loadReviews() {
    fetch("/filter_reviews")
      .then(r => r.json())
      .then(displayReviews)
      .catch(console.error);
  }

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
      `;
      reviewContainer.appendChild(wrapper);
    });
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
      })
      .catch(console.error);
  });

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"'`=\/]/g, function (c) {
      return {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
        "'": '&#39;', '/': '&#x2F;', '`':'&#x60;', '=': '&#x3D;'
      }[c];
    });
  }

  // ==========================
  // INITIAL LOAD
  // ==========================
  loadMovies();
  loadReviews();

});

/*document.addEventListener("DOMContentLoaded", () => {

  const movieContainer = document.getElementById("movie-results");
  const reviewContainer = document.getElementById("review-history");

  // ==========================
  // UTILITY: Mobile/Tablet check
  // ==========================
  function isMobileOrTablet() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  // ==========================
  // MOBILE FILTER TOGGLE
  // ==========================
  const toggleBtn = document.getElementById('toggle-filters');
  const filtersSection = document.getElementById('filters-section');

  function toggleFilters() {
    if (filtersSection.style.display === 'block') {
      filtersSection.style.display = 'none';
      toggleBtn.textContent = 'Show Filters';
    } else {
      filtersSection.style.display = 'block';
      toggleBtn.textContent = 'Hide Filters';
    }
  }

  toggleBtn.addEventListener('click', toggleFilters);

  function handleResponsiveFilters() {
    if (window.innerWidth > 768) {
      filtersSection.style.display = 'block';
      toggleBtn.style.display = 'none';
    } else {
      filtersSection.style.display = 'none';
      toggleBtn.style.display = 'block';
      toggleBtn.textContent = 'Show Filters';
    }
  }

  window.addEventListener('resize', handleResponsiveFilters);
  window.addEventListener('load', handleResponsiveFilters);

  // ==========================
  // SPEECH-TO-TEXT MICS
  // ==========================
  const micSearchBtn = document.getElementById('mic-search');
  const searchInput = document.getElementById('global-search');
  const micReviewBtn = document.getElementById('mic-review');
  const reviewInput = document.getElementById('review-text');

  function startSpeechToText(inputField) {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const tempRecog = new SpeechRecognition();
    tempRecog.continuous = false;
    tempRecog.lang = 'en-US';
    tempRecog.start();
    tempRecog.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      inputField.value += transcript;
    };
    tempRecog.onerror = (event) => console.error("Speech recognition error:", event.error);
  }

  micSearchBtn.addEventListener('click', () => startSpeechToText(searchInput));
  micReviewBtn.addEventListener('click', () => startSpeechToText(reviewInput));

  // ==========================
  // HOTWORD "OKAY BUDDY"
  // ==========================
  if (isMobileOrTablet() && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const hotwordRecog = new SpeechRecognition();
    hotwordRecog.continuous = true;
    hotwordRecog.lang = 'en-US';

    hotwordRecog.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim();
      if (/^okay buddy$/i.test(transcript)) {
        console.log("Hotword detected! Activating search mic...");
        startSpeechToText(searchInput);
      }
    };

    hotwordRecog.onerror = (event) => console.error("Hotword recognition error:", event.error);
    hotwordRecog.onend = () => {
      if (isMobileOrTablet()) hotwordRecog.start();
    };

    hotwordRecog.start();
  }

  // ==========================
  // MOVIES
  // ==========================
  function loadMovies() {
    fetch("/search_tmdb")
      .then(r => r.json())
      .then(displayMovies)
      .catch(console.error);
  }

  // Recognized genres
  const knownGenres = [
    "action", "adventure", "animation", "comedy", "crime", "documentary",
    "drama", "family", "fantasy", "history", "horror", "music",
    "mystery", "romance", "science fiction", "sci-fi", "tv movie",
    "thriller", "war", "western"
  ];

  function fetchMovies(query) {
    if (!query) {
      loadMovies();
      return;
    }

    const lower = query.toLowerCase();
    if (knownGenres.includes(lower)) {
      // genre search
      fetch(`/filter_movies?genre=${encodeURIComponent(lower)}`)
        .then(r => r.json())
        .then(displayMovies)
        .catch(console.error);
    } else {
      // title search
      fetch(`/search_tmdb?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(displayMovies)
        .catch(console.error);
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
      const year = (m.release_date || m.first_air_date || "").slice(0,4) || "—";
      const ytId = m.youtube_id || "dQw4w9WgXcQ"; // fallback trailer

      card.innerHTML = `
        <div class="poster"><img src="${posterPath}" onerror="this.style.display='none'"></div>
        <div class="info">
          <h3 class="movie-title">${title}</h3>
          <p>Year: ${year} • Rating: ${rating}</p>
          <p class="overview">${m.overview || ""}</p>
          <div class="actions">
            <button class="btn-trailer" data-yt="${ytId}">Play Trailer</button>
          </div>
        </div>
      `;

      movieContainer.appendChild(card);

      const btn = card.querySelector(".btn-trailer");
      btn.addEventListener("click", () => {
        const w = window.open(`https://www.youtube.com/watch?v=${btn.dataset.yt}`, "_blank");
        if (!w) alert("Popup blocked — open manually: https://youtube.com/watch?v=" + btn.dataset.yt);
      });
    });
  }

  document.getElementById("btn-search").addEventListener("click", () => {
    const q = searchInput.value.trim();
    fetchMovies(q);
  });

  document.getElementById("apply-movie-filters").addEventListener("click", () => {
    const genre = document.getElementById("filter-genre").value;
    const year = document.getElementById("filter-year").value;
    const rating = document.getElementById("filter-rating").value;
    fetch(`/filter_movies?genre=${encodeURIComponent(genre)}&year=${encodeURIComponent(year)}&rating=${encodeURIComponent(rating)}`)
      .then(r => r.json()).then(displayMovies).catch(console.error);
  });

  // ==========================
  // REVIEWS
  // ==========================
  function loadReviews() {
    fetch("/filter_reviews")
      .then(r => r.json())
      .then(displayReviews)
      .catch(console.error);
  }

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
      `;
      reviewContainer.appendChild(wrapper);
    });
  }

  document.getElementById("btn-add-review").addEventListener("click", () => {
    const title = document.getElementById("review-movie-title").value.trim() || "Unknown";
    const text = document.getElementById("review-text").value.trim();
    if (!text) return alert("Write a review first.");
    fetch("/add_review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movie_title: title, review_text: text })
    }).then(r => r.json())
      .then(() => {
        loadReviews();
        document.getElementById("review-text").value = "";
        document.getElementById("review-movie-title").value = "";
      }).catch(console.error);
  });

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"'`=\/]/g, function (c) {
      return {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
        "'": '&#39;', '/': '&#x2F;', '`':'&#x60;', '=': '&#x3D;'
      }[c];
    });
  }

  // ==========================
  // INITIAL LOAD
  // ==========================
  loadMovies();
  loadReviews();
});

/*document.addEventListener("DOMContentLoaded", () => {

  const movieContainer = document.getElementById("movie-results");
  const reviewContainer = document.getElementById("review-history");

  // ==========================
  // UTILITY: Mobile/Tablet check
  // ==========================
  function isMobileOrTablet() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  // ==========================
  // MOBILE FILTER TOGGLE
  // ==========================
  const toggleBtn = document.getElementById('toggle-filters');
  const filtersSection = document.getElementById('filters-section');

  function toggleFilters() {
    if (filtersSection.style.display === 'block') {
      filtersSection.style.display = 'none';
      toggleBtn.textContent = 'Show Filters';
    } else {
      filtersSection.style.display = 'block';
      toggleBtn.textContent = 'Hide Filters';
    }
  }

  toggleBtn.addEventListener('click', toggleFilters);

  function handleResponsiveFilters() {
    if (window.innerWidth > 768) {
      filtersSection.style.display = 'block';
      toggleBtn.style.display = 'none';
    } else {
      filtersSection.style.display = 'none';
      toggleBtn.style.display = 'block';
      toggleBtn.textContent = 'Show Filters';
    }
  }

  window.addEventListener('resize', handleResponsiveFilters);
  window.addEventListener('load', handleResponsiveFilters);

  // ==========================
  // SPEECH-TO-TEXT MICS
  // ==========================
  const micSearchBtn = document.getElementById('mic-search');
  const searchInput = document.getElementById('global-search');
  const micReviewBtn = document.getElementById('mic-review');
  const reviewInput = document.getElementById('review-text');

  // Simple speech-to-text helper
  function startSpeechToText(inputField) {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const tempRecog = new SpeechRecognition();
    tempRecog.continuous = false;
    tempRecog.lang = 'en-US';
    tempRecog.start();
    tempRecog.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      inputField.value += transcript;
    };
    tempRecog.onerror = (event) => console.error("Speech recognition error:", event.error);
  }

  micSearchBtn.addEventListener('click', () => startSpeechToText(searchInput));
  micReviewBtn.addEventListener('click', () => startSpeechToText(reviewInput));

  // ==========================
  // HOTWORD "OKAY BUDDY" ACTIVATION
  // Only on mobile/tablet
  // ==========================
  if (isMobileOrTablet() && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const hotwordRecog = new SpeechRecognition();
    hotwordRecog.continuous = true;
    hotwordRecog.lang = 'en-US';

    hotwordRecog.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim();
      console.log("Hotword detection transcript:", transcript);
      if (/^okay buddy$/i.test(transcript)) {
        console.log("Hotword detected! Activating search mic...");
        startSpeechToText(searchInput);
      }
    };

    hotwordRecog.onerror = (event) => console.error("Hotword recognition error:", event.error);
    hotwordRecog.onend = () => {
      if (isMobileOrTablet()) hotwordRecog.start(); // restart hotword listening
    };

    hotwordRecog.start();
  }

  // ==========================
  // MOVIES
  // ==========================
  function loadMovies() {
    fetch("/search_tmdb")
      .then(r => r.json())
      .then(displayMovies)
      .catch(console.error);
  }

  function fetchMovies(opts = {}) {
    const q = opts.q || "";
    fetch("/search_tmdb?q=" + encodeURIComponent(q))
      .then(r => r.json())
      .then(displayMovies)
      .catch(console.error);
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
      const year = (m.release_date || m.first_air_date || "").slice(0,4) || "—";
      const ytId = m.youtube_id || "dQw4w9WgXcQ"; // placeholder

      card.innerHTML = `
        <div class="poster"><img src="${posterPath}" onerror="this.style.display='none'"></div>
        <div class="info">
          <h3 class="movie-title">${title}</h3>
          <p>Year: ${year} • Rating: ${rating}</p>
          <p class="overview">${m.overview || ""}</p>
          <div class="actions">
            <button class="btn-trailer" data-yt="${ytId}">Play Trailer</button>
          </div>
        </div>
      `;

      movieContainer.appendChild(card);

      const btn = card.querySelector(".btn-trailer");
      btn.addEventListener("click", () => {
        const w = window.open(`https://www.youtube.com/watch?v=${btn.dataset.yt}`, "_blank");
        if (!w) alert("Popup blocked — open manually: https://youtube.com/watch?v=" + btn.dataset.yt);
      });
    });
  }

  document.getElementById("btn-search").addEventListener("click", () => {
    const q = searchInput.value.trim();
    fetchMovies({ q });
  });

  document.getElementById("apply-movie-filters").addEventListener("click", () => {
    const genre = document.getElementById("filter-genre").value;
    const year = document.getElementById("filter-year").value;
    const rating = document.getElementById("filter-rating").value;
    fetch(`/filter_movies?genre=${encodeURIComponent(genre)}&year=${encodeURIComponent(year)}&rating=${encodeURIComponent(rating)}`)
      .then(r => r.json()).then(displayMovies).catch(console.error);
  });

  // ==========================
  // REVIEWS
  // ==========================
  function loadReviews() {
    fetch("/filter_reviews")
      .then(r => r.json())
      .then(displayReviews)
      .catch(console.error);
  }

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
      `;
      reviewContainer.appendChild(wrapper);
    });
  }

  document.getElementById("btn-add-review").addEventListener("click", () => {
    const title = document.getElementById("review-movie-title").value.trim() || "Unknown";
    const text = document.getElementById("review-text").value.trim();
    if (!text) return alert("Write a review first.");
    fetch("/add_review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movie_title: title, review_text: text })
    }).then(r => r.json())
      .then(() => {
        loadReviews();
        document.getElementById("review-text").value = "";
        document.getElementById("review-movie-title").value = "";
      }).catch(console.error);
  });

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"'`=\/]/g, function (c) {
      return {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
        "'": '&#39;', '/': '&#x2F;', '`':'&#x60;', '=': '&#x3D;'
      }[c];
    });
  }

  // ==========================
  // INITIAL LOAD
  // ==========================
  loadMovies();
  loadReviews();
});

/*document.addEventListener("DOMContentLoaded", () => {

  const movieContainer = document.getElementById("movie-results");
  const reviewContainer = document.getElementById("review-history");

  // ==========================
  // MOBILE FILTER TOGGLE
  // ==========================
  const toggleBtn = document.getElementById('toggle-filters');
  const filtersSection = document.getElementById('filters-section');

  function toggleFilters() {
    if (filtersSection.style.display === 'block') {
      filtersSection.style.display = 'none';
      toggleBtn.textContent = 'Show Filters';
    } else {
      filtersSection.style.display = 'block';
      toggleBtn.textContent = 'Hide Filters';
    }
  }

  toggleBtn.addEventListener('click', toggleFilters);

  function handleResponsiveFilters() {
    if (window.innerWidth > 768) {
      filtersSection.style.display = 'block';
      toggleBtn.style.display = 'none';
    } else {
      filtersSection.style.display = 'none';
      toggleBtn.style.display = 'block';
      toggleBtn.textContent = 'Show Filters';
    }
  }

  window.addEventListener('resize', handleResponsiveFilters);
  window.addEventListener('load', handleResponsiveFilters);

  // ==========================
  // SPEECH-TO-TEXT
  // ==========================
  const micSearchBtn = document.getElementById('mic-search');
  const searchInput = document.getElementById('global-search');
  const micReviewBtn = document.getElementById('mic-review');
  const reviewInput = document.getElementById('review-text');
  let recognition;

  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
  } else {
    recognition = null;
  }

  function startSpeechToText(inputField) {
    if (!recognition) return;
    recognition.start();
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      inputField.value += transcript;
    };
  }

  micSearchBtn.addEventListener('click', () => startSpeechToText(searchInput));
  micReviewBtn.addEventListener('click', () => startSpeechToText(reviewInput));

  // ==========================
  // LOAD & DISPLAY MOVIES
  // ==========================
  function loadMovies() {
    fetch("/search_tmdb")
      .then(r => r.json())
      .then(displayMovies)
      .catch(console.error);
  }

  function fetchMovies(opts = {}) {
    const q = opts.q || "";
    fetch("/search_tmdb?q=" + encodeURIComponent(q))
      .then(r => r.json())
      .then(displayMovies)
      .catch(console.error);
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
      const year = (m.release_date || m.first_air_date || "").slice(0,4) || "—";

      // Always show Play Trailer button with a placeholder YouTube link if youtube_id is missing
      const ytId = m.youtube_id || "dQw4w9WgXcQ"; // default video as placeholder

      card.innerHTML = `
        <div class="poster"><img src="${posterPath}" onerror="this.style.display='none'"></div>
        <div class="info">
          <h3 class="movie-title">${title}</h3>
          <p>Year: ${year} • Rating: ${rating}</p>
          <p class="overview">${m.overview || ""}</p>
          <div class="actions">
            <button class="btn-trailer" data-yt="${ytId}">Play Trailer</button>
          </div>
        </div>
      `;

      movieContainer.appendChild(card);

      // Trailer button
      const btn = card.querySelector(".btn-trailer");
      btn.addEventListener("click", () => {
        const w = window.open(`https://www.youtube.com/watch?v=${btn.dataset.yt}`, "_blank");
        if (!w) alert("Popup blocked — open manually: https://youtube.com/watch?v=" + btn.dataset.yt);
      });
    });
  }

  document.getElementById("btn-search").addEventListener("click", () => {
    const q = searchInput.value.trim();
    fetchMovies({ q });
  });

  document.getElementById("apply-movie-filters").addEventListener("click", () => {
    const genre = document.getElementById("filter-genre").value;
    const year = document.getElementById("filter-year").value;
    const rating = document.getElementById("filter-rating").value;
    fetch(`/filter_movies?genre=${encodeURIComponent(genre)}&year=${encodeURIComponent(year)}&rating=${encodeURIComponent(rating)}`)
      .then(r => r.json()).then(displayMovies).catch(console.error);
  });

  // ==========================
  // REVIEWS
  // ==========================
  function loadReviews() {
    fetch("/filter_reviews")
      .then(r => r.json())
      .then(displayReviews)
      .catch(console.error);
  }

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
      `;
      reviewContainer.appendChild(wrapper);
    });
  }

  document.getElementById("btn-add-review").addEventListener("click", () => {
    const title = document.getElementById("review-movie-title").value.trim() || "Unknown";
    const text = document.getElementById("review-text").value.trim();
    if (!text) return alert("Write a review first.");
    fetch("/add_review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movie_title: title, review_text: text })
    }).then(r => r.json())
      .then(() => {
        loadReviews();
        document.getElementById("review-text").value = "";
        document.getElementById("review-movie-title").value = "";
      }).catch(console.error);
  });

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"'`=\/]/g, function (c) {
      return {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
        "'": '&#39;', '/': '&#x2F;', '`':'&#x60;', '=': '&#x3D;'
      }[c];
    });
  }

  // INITIAL LOAD
  loadMovies();
  loadReviews();
});
*/
//document.addEventListener("DOMContentLoaded", () => {
  // DOM refs
/*  const movieContainer = document.getElementById("movie-results");
  const reviewContainer = document.getElementById("review-history");

  // Initial load
  loadMovies();
  loadReviews();

  // Search button
  document.getElementById("btn-search").addEventListener("click", () => {
    const q = document.getElementById("global-search").value.trim();
    fetchMovies({ q });
  });

  // Apply movie filters
  document.getElementById("apply-movie-filters").addEventListener("click", () => {
    const genre = document.getElementById("filter-genre").value;
    const year = document.getElementById("filter-year").value;
    const rating = document.getElementById("filter-rating").value;
    fetch("/filter_movies?genre=" + encodeURIComponent(genre) + "&year=" + encodeURIComponent(year) + "&rating=" + encodeURIComponent(rating))
      .then(r => r.json())
      .then(displayMovies)
      .catch(console.error);
  });

  // Apply review filters
  document.getElementById("apply-review-filters").addEventListener("click", () => {
    const sentiment = document.getElementById("filter-sentiment").value;
    const dateOrder = document.getElementById("filter-date").value;
    const minWords = document.getElementById("filter-min-words").value;
    fetch("/filter_reviews?sentiment=" + encodeURIComponent(sentiment) + "&date_order=" + encodeURIComponent(dateOrder) + "&min_wordcount=" + encodeURIComponent(minWords))
      .then(r => r.json())
      .then(displayReviews)
      .catch(console.error);
  });

  // Client-side search-in-results
  document.getElementById("filter-search").addEventListener("input", (e) => {
    const term = e.target.value.trim().toLowerCase();
    document.querySelectorAll(".movie-card").forEach(card => {
      const t = card.querySelector(".movie-title").innerText.toLowerCase();
      card.style.display = t.includes(term) ? "" : "none";
    });
  });

  // Add review
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
    .then(res => {
      // refresh reviews
      loadReviews();
      document.getElementById("review-text").value = "";
      document.getElementById("review-movie-title").value = "";
    })
    .catch(console.error);
  });

  // Utility functions
  function loadMovies() {
    fetch("/search_tmdb")
      .then(r => r.json())
      .then(displayMovies)
      .catch(console.error);
  }

  function fetchMovies(opts = {}) {
    const q = opts.q || "";
    fetch("/search_tmdb?q=" + encodeURIComponent(q))
      .then(r => r.json())
      .then(displayMovies)
      .catch(console.error);
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
      const year = (m.release_date || m.first_air_date || "").slice(0,4) || "—";
      card.innerHTML = `
        <div class="poster"><img src="${posterPath}" onerror="this.style.display='none'"></div>
        <div class="info">
          <h3 class="movie-title">${title}</h3>
          <p>Year: ${year} • Rating: ${rating}</p>
          <p class="overview">${m.overview || ""}</p>
          <div class="actions">
            ${m.youtube_id ? `<button class="btn-trailer" data-yt="${m.youtube_id}">Play Trailer</button>` : ""}
          </div>
        </div>
      `;
      movieContainer.appendChild(card);
      // attach trailer handler
      const btn = card.querySelector(".btn-trailer");
      if (btn) {
        btn.addEventListener("click", () => {
          const vid = btn.dataset.yt;
          const w = window.open(`https://www.youtube.com/watch?v=${vid}`, "_blank");
          if (!w) alert("Popup blocked — open it manually: https://youtube.com/watch?v=" + vid);
        });
      }
    });
  }

  function loadReviews() {
    fetch("/filter_reviews")
      .then(r => r.json())
      .then(displayReviews)
      .catch(console.error);
  }

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
      `;
      reviewContainer.appendChild(wrapper);
    });
  }

  // small helper to avoid HTML injection when displaying user text
  function escapeHtml(s) {
    return (s || "").replace(/[&<>"'`=\/]/g, function (c) {
      return {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
        "'": '&#39;', '/': '&#x2F;', '`':'&#x60;', '=': '&#x3D;'
      }[c];
    });
  }

});*/
