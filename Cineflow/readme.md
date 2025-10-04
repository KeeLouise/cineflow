## readme file
				
## Github URL:
   
    Github repository: https://github.com/KeeLouise/cineflow

## Render URL:

    Render URL: https://cineflow-frontend.onrender.com/

## Django Admin Login:

    URL: https://cineflow-zglm.onrender.com/admin

    Username: cineflow_admin
    Password: Cineflow2025*

## Project Goals  

CineFlow is a modern, mood-based movie discovery web app powered by Django and React. The goal of the project is to make finding something to watch more intuitive and personal. Instead of browsing through endless genres or ratings, users can explore movies that match their mood.

Each user gets a personalized dashboard that suggests titles based on mood categories like Feel-Good, Scary, or Mind-Bending. CineFlow also supports account profiles, two-factor authentication, and avatar uploads to create a more personalized experience. The app connects to live data from TMDB (The Movie Database) to display up-to-date movie details and streaming availability.

The aim is to combine functionality and design—creating a clean, interactive platform for movie lovers to discover and manage what they want to watch, all in one place.

## Challenges Faced  

While building SkillStack, there were a few challenges:  

	•	Authentication and user management – Integrating JWT-based authentication and 2FA while ensuring smooth login, registration, and profile updates required careful handling of permissions and token validation.
	•	CORS and API integration – Working with TMDB and deployment on Render introduced CORS issues that had to be resolved for data and images to load securely.
	•	File uploads – Handling avatar uploads and updates through the API required using multipart form data and ensuring Cloudinary/media storage worked correctly.
	•	Error handling and validation – Creating clear API responses (for example, when an email already exists or a token is invalid) helped improve the overall user experience.
	•	Deployment configuration – Setting DEBUG=False on Render caused static file and authorization problems that needed additional environment configuration and middleware fixes.
    •	This was the first web app I have ever built with react so overall, I think that was the main challenge for me.


These challenges were a good learning experience and helped strengthen the project.  

## REST API

CineFlow already uses a REST API for authentication, profiles, and mood-based movie discovery—but it could grow further to make the platform more interactive and scalable. Future API expansions could include:
	•	Social features – Let users share moods, follow friends, or recommend movies directly through the app.
	•	Advanced recommendations – Personalized suggestions using aggregated viewing moods, genres, or user feedback.
	•	Analytics endpoints – Collect anonymous usage data to improve recommendations and optimize mood matching.

This API growth would make CineFlow even more flexible—opening it up to mobile versions, integrations, or future AI-powered recommendation engines.

## List of Sources

	•	desktop-logo.webp — Reidy, Kiera (2025). “CineFlow” [image]. Available at: https://github.com/KeeLouise/cineflow (Accessed: 18th August 2025).
