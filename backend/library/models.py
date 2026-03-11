from django.db import models


class LibraryBook(models.Model):
    title = models.CharField(max_length=200)
    author = models.CharField(max_length=150)
    isbn = models.CharField(max_length=20, unique=True)
    total_copies = models.PositiveIntegerField(default=1)
    available_copies = models.PositiveIntegerField(default=1)
    category = models.CharField(max_length=100, blank=True)
    added_on = models.DateField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} by {self.author} ({self.available_copies}/{self.total_copies} available)"
