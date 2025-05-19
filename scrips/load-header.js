
  document.addEventListener("DOMContentLoaded", function () {
      fetch('header.html') // si está al mismo nivel
  .then(res => res.text())
  .then(data => {
    document.getElementById('header-placeholder').innerHTML = data;
  });

  });

  function toggleMenu() {
    document.getElementById("mobileMenu").classList.toggle("show");
  }