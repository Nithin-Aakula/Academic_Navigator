from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import FeeRecordViewSet

router = DefaultRouter()
router.register(r'fees', FeeRecordViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
