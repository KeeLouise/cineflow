from django.contrib import admin
from .models import (
    UserProfile, MoodKeyword, Watchlist, WatchlistItem,
    Room, RoomMembership, RoomMovie, WatchlistCollaborator, WatchRoomVote
)

admin.site.register(UserProfile)
admin.site.register(MoodKeyword)
admin.site.register(Watchlist)
admin.site.register(WatchlistItem)
admin.site.register(Room)
admin.site.register(RoomMembership)
admin.site.register(RoomMovie)
admin.site.register(WatchlistCollaborator)
admin.site.register(WatchRoomVote)

# User Profile
@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "avatar_thumb", "email_verified",
                    "two_factor_enabled", "updated_at")
    list_filter = ("email_verified", "two_factor_enabled", "updated_at")
    search_fields = ("user__username", "user__email")
    readonly_fields = ("updated_at", "avatar_preview")

    fieldsets = (
        (None, {"fields": ("user",)}),
        ("Avatar", {"fields": ("avatar", "avatar_preview")}),
        ("Security", {
            "fields": (
                "email_verified",
                "two_factor_enabled",
                "two_factor_secret",
                "two_factor_confirmed_at",
            )
        }),
        ("Meta", {"fields": ("updated_at",)}),
    )

    def avatar_thumb(self, obj):
        if obj.avatar:
            return format_html('<img src="{}" style="height:32px;width:32px;border-radius:50%;" />', obj.avatar.url)
        return "—"
    avatar_thumb.short_description = "Avatar"

    def avatar_preview(self, obj):
        if obj.avatar:
            return format_html('<img src="{}" style="max-height:120px;border-radius:12px;" />', obj.avatar.url)
        return "—"
    avatar_preview.short_description = "Preview"


# Watchlists & Items
class WatchlistItemInline(admin.TabularInline):
    model = WatchlistItem
    extra = 0
    fields = ("position", "tmdb_id", "title", "status", "added_at")
    readonly_fields = ("added_at",)
    ordering = ("position",)

class WatchlistCollaboratorInline(admin.TabularInline):
    model = WatchlistCollaborator
    extra = 0
    fields = ("user", "can_edit", "invited_at")
    readonly_fields = ("invited_at",)

@admin.register(Watchlist)
class WatchlistAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "name", "is_public", "items_count",
                    "updated_at", "created_at")
    list_filter = ("is_public", "updated_at", "created_at")
    search_fields = ("name", "user__username", "user__email")
    inlines = [WatchlistItemInline, WatchlistCollaboratorInline]
    date_hierarchy = "created_at"
    ordering = ("-updated_at",)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.annotate(_items_count=Count("items"))

    def items_count(self, obj):
        return getattr(obj, "_items_count", 0)
    items_count.admin_order_field = "_items_count"

@admin.register(WatchlistItem)
class WatchlistItemAdmin(admin.ModelAdmin):
    list_display = ("id", "watchlist", "position", "tmdb_id", "title", "status", "added_at")
    list_filter = ("status", "added_at")
    search_fields = ("title", "tmdb_id", "watchlist__name", "watchlist__user__username")
    ordering = ("watchlist", "position", "-added_at")


@admin.register(WatchlistCollaborator)
class WatchlistCollaboratorAdmin(admin.ModelAdmin):
    list_display = ("id", "watchlist", "user", "can_edit", "invited_at")
    list_filter = ("can_edit", "invited_at")
    search_fields = ("watchlist__name", "user__username", "user__email")


# Rooms, Memberships, Movies, Votes
class RoomMembershipInline(admin.TabularInline):
    model = RoomMembership
    extra = 0
    fields = ("user", "is_host", "joined_at")
    readonly_fields = ("joined_at",)

class RoomMovieInline(admin.TabularInline):
    model = RoomMovie
    extra = 0
    fields = ("tmdb_id", "title", "position", "added_by", "added_at")
    readonly_fields = ("added_at",)
    ordering = ("position",)

@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "owner", "is_active", "starts_at",
                    "invite_code", "created_at")
    list_filter = ("is_active", "starts_at", "created_at")
    search_fields = ("name", "invite_code", "owner__username", "owner__email")
    inlines = [RoomMembershipInline, RoomMovieInline]
    date_hierarchy = "created_at"
    ordering = ("-created_at",)

@admin.register(RoomMembership)
class RoomMembershipAdmin(admin.ModelAdmin):
    list_display = ("id", "room", "user", "is_host", "joined_at")
    list_filter = ("is_host", "joined_at")
    search_fields = ("room__name", "user__username", "user__email")

@admin.register(RoomMovie)
class RoomMovieAdmin(admin.ModelAdmin):
    list_display = ("id", "room", "tmdb_id", "title", "position",
                    "added_by", "votes_count", "added_at")
    list_filter = ("added_at",)
    search_fields = ("title", "tmdb_id", "room__name", "added_by__username")
    ordering = ("room", "position", "-added_at")

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.annotate(_votes_count=Count("votes"))

    def votes_count(self, obj):
        return getattr(obj, "_votes_count", 0)
    votes_count.admin_order_field = "_votes_count"

@admin.register(WatchRoomVote)
class WatchRoomVoteAdmin(admin.ModelAdmin):
    list_display = ("id", "room_movie", "user", "value", "created_at")
    list_filter = ("value", "created_at")
    search_fields = ("room_movie__title", "room_movie__room__name", "user__username")


# Moods / Keywords
@admin.register(MoodKeyword)
class MoodKeywordAdmin(admin.ModelAdmin):
    list_display = ("mood", "keyword_id", "keyword_name", "weight")
    list_filter = ("mood",)
    search_fields = ("mood", "keyword_name", "keyword_id")
    ordering = ("mood", "-weight", "keyword_name")
