export function isAuthenticated() {
    return !!localStorage.getItem("access"); //true if token exists - KR 20/08/2025
}

export function logout() { //logout function to remove access tokens - KR 21/08/2025
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    window.location.href = "/login";
}