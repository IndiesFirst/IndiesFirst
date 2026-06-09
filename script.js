const SUPABASE_URL = 'https://lytdiftjumipdqoolyen.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7MiQ2ZRsAbPLQjKtvWafiw_aKO1RKe9';

let sbClient = null;

document.addEventListener('DOMContentLoaded', () => {
  console.log('SCRIPT LOADED');

  if (window.supabase && typeof window.supabase.createClient === 'function') {
    sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.error('Supabase library not loaded');
    return;
  }

  const searchButton = document.getElementById('search-button');
  const authorsButton = document.getElementById('authors-button');
  const findButton = document.getElementById('find-button');

  if (searchButton) {
    searchButton.addEventListener('click', () => {
      const resultsEl = document.getElementById('results');
      if (resultsEl) resultsEl.innerHTML = '<p>Searching...</p>';
      searchBooks();
    });
  }

  if (authorsButton) {
    authorsButton.addEventListener('click', () => {
      alert('Coming Later');
    });
  }

  if (findButton) {
    findButton.addEventListener('click', () => {
      const authorsResults = document.getElementById('authors-results');
      if (authorsResults) authorsResults.innerHTML = '<p>Searching...</p>';
      findAuthorTools();
    });
  }

  loadInitialBooks();
});

function requireSupabase() {
  if (!sbClient) {
    alert('Supabase is not initialized yet.');
    return false;
  }
  return true;
}

function normalizeText(str = '') {
  return String(str || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeIsbn(value = '') {
  return String(value || '').replace(/[^0-9Xx]/g, '').toUpperCase();
}

function getTier(reviews) {
  if (reviews < 100) return 'tier-0';
  if (reviews < 1000) return 'tier-100';
  return 'tier-1000';
}

function dedupeBooks(rows) {
  const seen = new Set();
  return (rows || []).filter((book) => {
    const key = [
      normalizeIsbn(book.isbn || ''),
      normalizeText(book.title || ''),
      normalizeText(book.author || ''),
      book.source || ''
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderResults(rows) {
  const resultsEl = document.getElementById('results');
  if (!resultsEl) return;

  if (!rows || rows.length === 0) {
    resultsEl.innerHTML = '<p>No books found.</p>';
    return;
  }

  resultsEl.innerHTML = rows.map((book, index) => {
    const cover = book.cover || book.cover_url || book.image || book.front_cover || book.thumbnail || '';
    const backCover = book.back_cover || book.back_cover_url || '';
    const blurb = book.description || book.blurb || '';
    const reviews = book.reviews_count ?? 0;
    const tier = getTier(reviews);
    const sourceUrl = book.source_url || book.url || '';

    return `
      <div class="book-card ${tier}" data-index="${index}">
        ${cover ? `<img src="${cover}" alt="${book.title || 'Front Cover'}" class="book-cover front-cover">` : ''}
        ${backCover ? `<img src="${backCover}" alt="${book.title || 'Back Cover'}" class="book-cover back-cover">` : ''}
        <div class="card-body">
          <h3>${book.title || 'Untitled'}</h3>
          <p><strong>Author:</strong> ${book.author || 'Unknown'}</p>
          <p><strong>ISBN:</strong> ${book.isbn || 'N/A'}</p>
          <p><strong>Reviews:</strong> ${reviews}</p>
          <p class="summary">${blurb || 'No summary available'}</p>
          <p><strong>Source:</strong> ${book.source || 'Verified Catalog'}</p>
          ${sourceUrl ? `<p><strong>URL:</strong> <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">${sourceUrl}</a></p>` : ''}
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.book-card').forEach((card, index) => {
    card.addEventListener('click', () => openBook(rows[index]));
  });
}

function renderAuthorsMenu(rows) {
  const authorsResultsEl = document.getElementById('authors-results');
  if (!authorsResultsEl) return;

  if (!rows || rows.length === 0) {
    authorsResultsEl.innerHTML = '<p>No books found.</p>';
    return;
  }

  authorsResultsEl.innerHTML = rows.map((book, index) => {
    const cover = book.cover || book.cover_url || book.image || book.front_cover || book.thumbnail || '';
    const blurb = book.description || book.blurb || '';
    const reviews = book.reviews_count ?? 0;
    const tier = getTier(reviews);
    const sourceUrl = book.source_url || book.url || book.link || '';

    return `
      <div class="book-card ${tier}" data-index="${index}">
        ${cover ? `<img src="${cover}" alt="${book.title || 'Front Cover'}" class="book-cover front-cover">` : ''}
        <div class="card-body">
          <h3>${book.title || 'Untitled'}</h3>
          <p><strong>Author:</strong> ${book.author || 'Unknown'}</p>
          <p><strong>ISBN:</strong> ${book.isbn || 'N/A'}</p>
          <p><strong>Reviews:</strong> ${reviews}</p>
          <p class="summary">${blurb || 'No summary available'}</p>
          <p><strong>Source:</strong> ${book.source || 'Verified Catalog'}</p>
          ${sourceUrl ? `<p><strong>URL:</strong> <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">${sourceUrl}</a></p>` : ''}
          <div class="card-actions">
            <button class="edit-book-btn" data-book-index="${index}">Edit</button>
            <button class="save-book-btn" data-book-index="${index}">Save</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.edit-book-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.getAttribute('data-book-index'), 10);
      openBookEditor(rows[index]);
    });
  });

  document.querySelectorAll('.save-book-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.getAttribute('data-book-index'), 10);
      addBookToDatabase(rows[index]);
    });
  });

  document.querySelectorAll('#authors-results .book-card').forEach((card, index) => {
    card.addEventListener('click', () => openBook(rows[index]));
  });
}

function openBookEditor(book) {
  const title = prompt('Title', book.title || '');
  if (title === null) return;

  const author = prompt('Author', book.author || '');
  if (author === null) return;

  const isbn = prompt('ISBN', book.isbn || '');
  if (isbn === null) return;

  const description = prompt('Description', book.description || book.blurb || '');
  if (description === null) return;

  const reviewsCount = prompt('Reviews count', String(book.reviews_count ?? 0));
  if (reviewsCount === null) return;

  const cover = prompt('Cover URL', book.cover || book.cover_url || book.image || '');
  if (cover === null) return;

  const sourceUrl = prompt('Book Source URL', book.source_url || book.url || book.link || '');
  if (sourceUrl === null) return;

  const updatedBook = {
    ...book,
    title: title.trim(),
    author: author.trim(),
    isbn: isbn.trim(),
    description: description.trim(),
    reviews_count: Number(reviewsCount || 0),
    cover: cover.trim(),
    source_url: sourceUrl.trim()
  };

  addBookToDatabase(updatedBook);
}

function openBook(book) {
  alert(
    `Title: ${book.title || 'Untitled'}\n` +
    `Author: ${book.author || 'Unknown'}\n` +
    `ISBN: ${book.isbn || 'N/A'}\n` +
    `Reviews: ${book.reviews_count ?? 0}\n` +
    `Source: ${book.source || 'Verified Catalog'}\n\n` +
    `${book.description || book.blurb || 'No description available'}`
  );
}

async function searchBooks() {
  console.log('searchBooks fired');
  if (!requireSupabase()) return;

  const query = document.getElementById('search-input')?.value.trim() || '';
  const resultsEl = document.getElementById('results');

  if (!query) {
    if (resultsEl) resultsEl.innerHTML = '<p>No books found.</p>';
    return;
  }

  try {
    const cleaned = normalizeIsbn(query);
    const isIsbn = cleaned.length === 10 || cleaned.length === 13;

    const externalResponse = await sbClient.functions.invoke('book-search', {
      body: isIsbn
        ? { isbn: cleaned, query, mode: 'isbn' }
        : { title: query, author: query, query, mode: 'text' }
    });

    const dbResponse = isIsbn
      ? await sbClient.from('my_books').select('*').eq('isbn', cleaned)
      : await sbClient.from('my_books').select('*').or(`title.ilike.%${query}%,author.ilike.%${query}%`);

    const results = [];

    if (!externalResponse.error && externalResponse.data?.results) {
      results.push(...externalResponse.data.results);
    }

    if (!dbResponse.error && dbResponse.data) {
      results.push(...dbResponse.data);
    }

    const finalResults = dedupeBooks(results);
    renderResults(finalResults);
  } catch (err) {
    console.error('searchBooks failed', err);
    if (resultsEl) resultsEl.innerHTML = '<p>No books found.</p>';
  }
}

function resetAuthorsMenuForm() {
  const authorSearchInput = document.getElementById('author-search-input');
  const bookUrlInput = document.getElementById('book-url');
  if (authorSearchInput) authorSearchInput.value = '';
  if (bookUrlInput) bookUrlInput.value = '';
}

async function addBookToDatabase(book) {
  if (!requireSupabase()) return;

  try {
    const payload = {
      title: book.title || null,
      author: book.author || null,
      isbn: book.isbn || null,
      cover: book.cover || book.cover_url || null,
      description: book.description || book.blurb || null,
      reviews_count: Number(book.reviews_count || 0),
      source: book.source || 'User Edited',
      source_url: book.source_url || book.url || null,
      added_at: new Date().toISOString()
    };

    const { error } = await sbClient
      .from('my_books')
      .insert([payload]);

    if (error) throw error;

    alert(`"${payload.title || 'Book'}" saved to your database!`);
    resetAuthorsMenuForm();
    clearAuthorsMenuState();
	
  } catch (err) {
    console.error('addBookToDatabase failed', err);
    alert('Failed to save book. Check console for details.');
  }
}

async function findAuthorTools() {
  if (!requireSupabase()) return;

  const textQuery = document.getElementById('author-search-input')?.value.trim() || '';
  const urlQuery = document.getElementById('book-url')?.value.trim() || '';
  const authorsMenu = document.getElementById('authors-menu');
  const authorsResultsEl = document.getElementById('authors-results');

  if (!textQuery && !urlQuery) {
    alert('Enter ISBN, title, author, or a book URL.');
    return;
  }

  if (authorsMenu) authorsMenu.classList.remove('hidden');
  if (authorsResultsEl) authorsResultsEl.innerHTML = '<p>Searching...</p>';

  try {
    const cleanQuery = textQuery.trim();
    const cleanedIsbn = normalizeIsbn(cleanQuery);
    const isIsbn = cleanedIsbn.length === 10 || cleanedIsbn.length === 13;

    let dbMatches = [];

    if (cleanQuery) {
      let dbQuery = sbClient.from('my_books').select('*');

      if (isIsbn) {
        dbQuery = dbQuery.eq('isbn', cleanedIsbn);
      } else {
        dbQuery = dbQuery.or(`title.ilike.%${cleanQuery}%,author.ilike.%${cleanQuery}%`);
      }

      const { data, error } = await dbQuery.limit(10);
      if (error) throw error;
      dbMatches = data || [];
    }

    if (dbMatches.length > 0) {
      renderAuthorsMenu(dedupeBooks(dbMatches));
      return;
    }

    const jobs = [];

    if (textQuery) {
      jobs.push(
        sbClient.functions.invoke('book-search', {
          body: { query: textQuery, mode: 'text' }
        })
      );
    }

    if (urlQuery) {
      jobs.push(
        sbClient.functions.invoke('parse-book-url', {
          body: { url: urlQuery }
        })
      );
    }

    const responses = await Promise.all(jobs);
    const merged = [];

    for (const res of responses) {
      if (res.error) throw res.error;
      if (Array.isArray(res.data?.results)) merged.push(...res.data.results);
      else if (res.data) merged.push(res.data);
    }

    renderAuthorsMenu(dedupeBooks(merged));
  } catch (err) {
    console.error('findAuthorTools failed', err);
    if (authorsResultsEl) authorsResultsEl.innerHTML = '<p>No books found.</p>';
  }
}

async function loadInitialBooks() {
  if (!requireSupabase()) return;

  try {
    const { data: dbRows } = await sbClient
      .from('my_books')
      .select('*')
      .order('added_at', { ascending: false })
      .limit(6);

    const externalResponse = await sbClient.functions.invoke('book-search', {
      body: { query: 'popular books', mode: 'text' }
    });

    const apiRows = externalResponse.error ? [] : (externalResponse.data?.results || []).slice(0, 6);

    renderResults(dedupeBooks([...(dbRows || []), ...apiRows]).slice(0, 12));
  } catch (err) {
    console.error('loadInitialBooks failed', err);
  }
}

function clearAuthorsMenuState() {
  const authorSearchInput = document.getElementById('author-search-input');
  const bookUrlInput = document.getElementById('book-url');
  const authorsResultsEl = document.getElementById('authors-results');

  if (authorSearchInput) authorSearchInput.value = '';
  if (bookUrlInput) bookUrlInput.value = '';
  if (authorsResultsEl) authorsResultsEl.innerHTML = '';
}
