from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    # JWT Auth
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # App routers
    path('api/', include('users.urls')),
    path('api/', include('academics.urls')),
    path('api/', include('timetable.urls')),
    path('api/', include('attendance_fr.urls')),
    path('api/', include('fees.urls')),
    path('api/', include('library.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
