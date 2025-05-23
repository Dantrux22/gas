document.addEventListener("DOMContentLoaded", function () {
    fetch('./components/header.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById("header-placeholder").innerHTML = data;
        })
        .catch(error => console.error("Error al cargar el header:", error));
});

function toggleMenu() {
    document.getElementById("mobileMenu").classList.toggle("show");
}
