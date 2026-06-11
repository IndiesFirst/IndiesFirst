const SUPABASE_URL = 'https://xbtqmiefkhaoncboiuvv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7MiQ2ZRsAbPLQjKtvWafiw_aKO1RKe9';

let sbClient = null;
let pendingCoverImage = null;
let coverFile = null;
let coverDropzone = null;
let coverPreview = null;
let editingBookCover = null;

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

  coverFile = document.getElementById('cover-file');
  coverDropzone = document.getElementById('cover-dropzone');
  coverPreview = document.getElementById('cover-preview');

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

  if (coverFile) {
    coverFile.addEventListener('change', () => {
      if (coverFile.files?.[0]) handleCoverFile(coverFile.files[0]);
    });
  }

  if (coverDropzone) {
    coverDropzone.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items || [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) handleCoverFile(file);
          break;
        }
      }
    });

    coverDropzone.addEventListener('dragover', (e) => e.preventDefault());

    coverDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) handleCoverFile(file);
    });
  }

  loadInitialBooks();
});

function handleCoverFile(file) {
  if (!file || !file.type.startsWith('image/')) return;

  const reader = new FileReader();
  reader.onload = () => {
    pendingCoverImage = reader.result;
    if (coverPreview) {
      coverPreview.src = reader.result;
      coverPreview.style.display = 'block';
    }
  };
  reader.readAsDataURL(file);
}

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
          ${book.genre ? `<p><strong>Genre:</strong> ${book.genre}</p>` : ''}
          ${book.keywords ? `<p><strong>Keywords:</strong> ${book.keywords}</p>` : ''}
		</div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.book-card').forEach((card, index) => {
    card.addEventListener('click', () => {
  const url = rows[index].source_url || rows[index].url || rows[index].link || '';
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
});
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
  editingBookCover = book.cover || book.cover_url || book.image || '';
  pendingCoverImage = null;

  const overlay = document.createElement('div');
  overlay.id = 'book-editor-overlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.6)';
  overlay.style.zIndex = '9999';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'flexstart';
  overlay.style.justifyContent = 'center';
  overlay.style.padding = '20px';

  overlay.innerHTML = `
    <div id="book-editor-modal" style="background:#fff;max-width:700px;width:100%;max-height:90vh;overflow:auto;border-radius:12px;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,0.25);">
      <h2>Edit Book</h2>

      <div style="display:grid;gap:10px;">
        <label>Title <input id="edit-title" type="text" value="${book.title || ''}"></label>
        <label>Author <input id="edit-author" type="text" value="${book.author || ''}"></label>
        <label>ISBN <input id="edit-isbn" type="text" value="${book.isbn || ''}"></label>
        <label>Description <textarea id="edit-description" rows="4">${book.description || book.blurb || ''}</textarea></label>
        <label>Reviews Count <input id="edit-reviews" type="number" value="${book.reviews_count ?? 0}"></label>
        <label>Source URL <input id="edit-source-url" type="url" value="${book.source_url || book.url || book.link || ''}"></label>
		<label>Genre <input id="edit-genre" type="text" value="${book.genre || ''}"></label>
        <label>Keywords <textarea id="edit-keywords" rows="3">${book.keywords || ''}</textarea></label>
      </div>

      <div style="margin-top:16px;">
        <img id="editor-cover-preview" alt="Cover preview" style="display:${editingBookCover ? 'block' : 'none'};max-width:180px;border-radius:8px;margin-bottom:10px;">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          <button type="button" id="editor-upload-btn">Upload Cover</button>
          <input type="file" id="editor-upload-input" accept="image/*" hidden>
          <button type="button" id="editor-save-btn">Save</button>
          <button type="button" id="editor-cancel-btn">Cancel</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const preview = overlay.querySelector('#editor-cover-preview');
  const uploadBtn = overlay.querySelector('#editor-upload-btn');
  const uploadInput = overlay.querySelector('#editor-upload-input');
  const saveBtn = overlay.querySelector('#editor-save-btn');
  const cancelBtn = overlay.querySelector('#editor-cancel-btn');

  if (preview && editingBookCover) {
    preview.src = editingBookCover;
    preview.style.display = 'block';
  }

  if (uploadBtn && uploadInput && preview) {
    uploadBtn.addEventListener('click', () => uploadInput.click());
    uploadInput.addEventListener('change', () => {
      const file = uploadInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        pendingCoverImage = reader.result;
        preview.src = reader.result;
        preview.style.display = 'block';
      };
      reader.readAsDataURL(file);
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const updatedBook = {
        ...book,
        title: overlay.querySelector('#edit-title')?.value.trim() || '',
        author: overlay.querySelector('#edit-author')?.value.trim() || '',
        isbn: overlay.querySelector('#edit-isbn')?.value.trim() || '',
        description: overlay.querySelector('#edit-description')?.value.trim() || '',
        reviews_count: Number(overlay.querySelector('#edit-reviews')?.value || 0),
        source_url: overlay.querySelector('#edit-source-url')?.value.trim() || '',
		genre: overlay.querySelector('#edit-genre')?.value.trim() || '',
        keywords: overlay.querySelector('#edit-keywords')?.value.trim() || ''
      };

      addBookToDatabase(updatedBook);
      overlay.remove();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      overlay.remove();
      pendingCoverImage = null;
    });
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      pendingCoverImage = null;
    }
  });
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

    let dbResponse;
    if (isIsbn) {
      dbResponse = await sbClient
        .from('my_books')
        .select('*')
        .eq('isbn', cleaned);
    } else {
      dbResponse = await sbClient
        .from('my_books')
        .select('*')
        .or(`title.ilike.%${query}%,author.ilike.%${query}%,genre.ilike.%${query}%,keywords.ilike.%${query}%`);
	}
	const externalResponse = await sbClient.functions.invoke('book-search', {
      body: isIsbn
        ? { isbn: cleaned, query, mode: 'isbn' }
        : { title: query, author: query, query, mode: 'text' }
    });

    const results = [];

    if (!dbResponse.error && dbResponse.data) {
      results.push(...dbResponse.data);
    }

    if (!externalResponse.error && externalResponse.data?.results) {
      results.push(...externalResponse.data.results);
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
      cover: pendingCoverImage || editingBookCover || book.cover || book.cover_url || book.image || null,
      description: book.description || book.blurb || null,
      reviews_count: Number(book.reviews_count || 0),
      source: book.source || 'User Edited',
      source_url: book.source_url || book.url || book.link || null,
      added_at: new Date().toISOString(),
	  genre: book.genre || null,
      keywords: book.keywords || null,
    };

    const { error } = await sbClient
      .from('my_books')
      .insert([payload]);

    if (error) throw error;

    alert(`"${payload.title || 'Book'}" saved to your database!`);
    resetAuthorsMenuForm();
    clearAuthorsMenuState();
    pendingCoverImage = null;
    editingBookCover = null;
	location.reload();
	
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

function shuffleArray(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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

        const shuffledDb = shuffleArray(dedupeBooks(dbRows || []));
    const shuffledApi = shuffleArray(dedupeBooks(apiRows || []));

    renderResults([...shuffledDb, ...shuffledApi].slice(0, 12));
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