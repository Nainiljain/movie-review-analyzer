// static/script.js
document.addEventListener("DOMContentLoaded", () => {
  const movieContainer = document.getElementById("movie-results");
  const reviewContainer = document.getElementById("review-history");
  const searchInput = document.getElementById("global-search");
  const reviewInput = document.getElementById("review-text");
  const micSearchBtn = document.getElementById("mic-search");
  const micReviewBtn = document.getElementById("mic-review");
  const trailerFrame = document.getElementById("youtube-trailer");
  const themeToggleBtn = document.getElementById("theme-toggle");
  const languageSelect = document.getElementById("language-select");

  // === 🎤 Speech Recognition ===
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = "en-US"; // default
    recognition.interimResults = false;
  }

  function handleMic(button, inputField) {
    if (!recognition) {
      alert("Speech Recognition not supported in this browser.");
      return;
    }

    recognition.lang = languageSelect?.value || "en-US"; // 🌍 multi-language

    recognition.start();
    button.classList.add("recording");

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      inputField.value = transcript;
      button.classList.remove("recording");
    };

    recognition.onerror = () => button.classList.remove("recording");
    recognition.onend = () => button.classList.remove("recording");
  }

  micSearchBtn?.addEventListener("click", () =>
    handleMic(micSearchBtn, searchInput)
  );
  micReviewBtn?.addEventListener("click", () =>
    handleMic(micReviewBtn, reviewInput)
  );

  // === 🔊 Text-to-Speech ===
  function speakText(text) {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = languageSelect?.value || "en-US";
      speechSynthesis.speak(utterance);
    } else {
      alert("Text-to-Speech not supported.");
    }
  }

  // === 🔍 Global Search (Movies + Trailer) ===
  document
    .getElementById("search-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const query = searchInput.value.trim();
      if (!query) return;

      try {
        const res = await fetch(`/search?query=${encodeURIComponent(query)}`);
        const data = await res.json();

        if (data.error) {
          movieContainer.innerHTML = `<p class="error">${data.error}</p>`;
          return;
        }

        // 🎬 Display Movie Info
        movieContainer.innerHTML = `
          <div class="movie-card">
            <img src="${data.poster_url}" alt="${data.title}" class="movie-poster"/>
            <h2>${data.title} (${data.release_date})</h2>
            <p>${data.overview}</p>
          </div>
        `;

        // 🎥 Update Trailer
        if (data.trailer_url) {
          trailerFrame.src = `https://www.youtube.com/embed/${data.trailer_url}`;
          trailerFrame.style.display = "block";
        } else {
          trailerFrame.style.display = "none";
        }

        // 🔊 Speak movie details
        speakText(`${data.title}. Released in ${data.release_date}. ${data.overview}`);
      } catch (err) {
        console.error("Search error:", err);
      }
    });

  // === 📝 Review Analyzer ===
  document
    .getElementById("review-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const review = reviewInput.value.trim();
      if (!review) return;

      try {
        const res = await fetch("/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ review }),
        });
        const data = await res.json();

        if (data.error) {
          alert(data.error);
          return;
        }

        // 📜 Add to Review History
        const newRow = document.createElement("tr");
        newRow.innerHTML = `
          <td>${data.review}</td>
          <td>${data.word_count}</td>
          <td>${data.sentiment}</td>
        `;
        reviewContainer.querySelector("tbody").appendChild(newRow);

        // 🔊 Speak sentiment
        speakText(`Your review sentiment is ${data.sentiment}`);

        reviewInput.value = "";
      } catch (err) {
        console.error("Review analyze error:", err);
      }
    });

  // === 🎨 Theme Toggle ===
  themeToggleBtn?.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    if (document.body.classList.contains("dark-mode")) {
      themeToggleBtn.innerText = "🌞 Light Mode";
    } else {
      themeToggleBtn.innerText = "🌙 Dark Mode";
    }
  });
});

/*document.addEventListener("DOMContentLoaded", () => {
  const movieContainer = document.getElementById("movie-results");
  const reviewContainer = document.getElementById("review-history");

  const searchInput = document.getElementById("global-search");
  const reviewInput = document.getElementById("review-text");
  const micSearchBtn = document.getElementById("mic-search");
  const micReviewBtn = document.getElementById("mic-review");

  const toggleBtn = document.getElementById("toggle-filters");
  const filtersSection = document.getElementById("filters-section");

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
        "'": '&#39;', '/': '&#x2F;', '`':'&#x60;', '=': '&#x3D;'
      }[c];
    });
  }

  function handleResponsiveFilters() {
    if (window.innerWidth > 768) {
      filtersSection.style.display = "block";
      toggleBtn.style.display = "none";
    } else {
      filtersSection.style.display = "none";
      toggleBtn.style.display = "block";
      toggleBtn.textContent = "Show Filters";
    }
  }

  toggleBtn.addEventListener("click", () => {
    if (filtersSection.style.display === "block") {
      filtersSection.style.display = "none";
      toggleBtn.textContent = "Show Filters";
    } else {
      filtersSection.style.display = "block";
      toggleBtn.textContent = "Hide Filters";
    }
  });

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
    "action","adventure","animation","comedy","crime","documentary",
    "drama","family","fantasy","history","horror","music",
    "mystery","romance","science fiction","sci-fi","tv movie",
    "thriller","war","western"
  ];

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
        const w = window.open(`https://www.youtube.com/watch?v=${ytId}`, "_blank");
        if (!w) alert("Popup blocked — open manually: https://youtube.com/watch?v=" + ytId);
      });
    });
  }

  function fetchMovies(query="") {
    if (!query) return fetch("/search_tmdb").then(r=>r.json()).then(displayMovies).catch(console.error);
    const lower = query.toLowerCase();
    if (knownGenres.includes(lower)) {
      fetch(`/filter_movies?genre=${encodeURIComponent(lower)}`).then(r=>r.json()).then(displayMovies).catch(console.error);
    } else {
      fetch(`/search_tmdb?q=${encodeURIComponent(query)}`).then(r=>r.json()).then(displayMovies).catch(console.error);
    }
  }

  document.getElementById("btn-search").addEventListener("click", () => {
    fetchMovies(searchInput.value.trim());
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
    }).catch(console.error);
  });

  // ==========================
  // INITIAL LOAD
  // ==========================
  fetchMovies();
  loadReviews();
});*/
