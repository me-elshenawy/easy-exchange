let role = '';

function login() {
  const user = document.getElementById('user').value.trim();
  const password = document.getElementById('password').value.trim();

  if (user === 'admin' && password === 'J8D04825') {
    role = 'admin';
  } else if (user === 'moderator' && password === 'K5P22817') {
    role = 'moderator';
  } else {
    alert('Invalid username or password!');
    return;
  }

  document.getElementById('login').style.display = 'none';
  document.getElementById('database').style.display = 'block';
  loadData();
}

const users = JSON.parse(localStorage.getItem('users')) || [];

function loadData() {
  const tableHeaders = document.getElementById('tableHeaders');
  const dataRows = document.getElementById('dataRows');

  tableHeaders.innerHTML = '';
  dataRows.innerHTML = '';

  if (role === 'admin') {
    tableHeaders.innerHTML = `
      <th>Username</th>
      <th>Name</th>
      <th>Birth Date</th>
      <th>Phone</th>
      <th>Code</th>
      <th>Actions</th>
    `;
  } else if (role === 'moderator') {
    tableHeaders.innerHTML = `
      <th>Username</th>
      <th>Name</th>
      <th>Code</th>
    `;
  }

  users.forEach((user, index) => {
    const row = document.createElement('tr');
    if (role === 'admin') {
      row.innerHTML = `
        <td>${user.username}</td>
        <td>${user.name}</td>
        <td>${user.birthDate}</td>
        <td>${user.phone}</td>
        <td>${user.code}</td>
        <td><button class="btn" onclick="deleteUser(${index})">Delete</button></td>
      `;
    } else if (role === 'moderator') {
      row.innerHTML = `
        <td>${user.username}</td>
        <td>${user.name}</td>
        <td>${user.code}</td>
      `;
    }

    dataRows.appendChild(row);
  });
}

function deleteUser(index) {
  if (role !== 'admin') return;
  users.splice(index, 1);
  localStorage.setItem('users', JSON.stringify(users));
  loadData();
}

function search() {
  const searchInput = document.getElementById('searchInput').value.trim().toLowerCase();
  const searchType = document.getElementById('searchType').value;

  const filteredUsers = users.filter(user => user[searchType]?.toLowerCase().includes(searchInput));
  renderTable(filteredUsers);
}

function resetSearch() {
  loadData();
}

function renderTable(data) {
  const dataRows = document.getElementById('dataRows');
  dataRows.innerHTML = '';

  data.forEach((user, index) => {
    const row = document.createElement('tr');

    if (role === 'admin') {
      row.innerHTML = `
        <td>${user.username}</td>
        <td>${user.name}</td>
        <td>${user.birthDate}</td>
        <td>${user.phone}</td>
        <td>${user.code}</td>
        <td><button class="btn" onclick="deleteUser(${index})">Delete</button></td>
      `;
    } else if (role === 'moderator') {
      row.innerHTML = `
        <td>${user.username}</td>
        <td>${user.name}</td>
        <td>${user.code}</td>
      `;
    }

    dataRows.appendChild(row);
  });
}