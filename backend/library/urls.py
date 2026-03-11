from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import LibraryBookViewSet

router = DefaultRouter()
router.register(r'library', LibraryBookViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
