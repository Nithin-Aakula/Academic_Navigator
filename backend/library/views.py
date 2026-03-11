from rest_framework import viewsets, permissions
from .models import LibraryBook
from .serializers import LibraryBookSerializer


class LibraryBookViewSet(viewsets.ModelViewSet):
    queryset = LibraryBook.objects.all()
    serializer_class = LibraryBookSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(title__icontains=search) | qs.filter(author__icontains=search)
        available = self.request.query_params.get('available')
        if available == 'true':
            qs = qs.filter(available_copies__gt=0)
        return qs
