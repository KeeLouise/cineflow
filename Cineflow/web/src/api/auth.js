export function logout() {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    window.location.href = "/login"; //force redirect to login page - KR 20/08/2025
}

export function isAuthenticated() {
    return !!localStorage.getItem("access"); //true if token exists - KR 20/08/2025
}