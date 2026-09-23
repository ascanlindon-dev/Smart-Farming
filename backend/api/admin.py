from django.contrib import admin
from .models import Farmer

@admin.register(Farmer)
class FarmerAdmin(admin.ModelAdmin):
	list_display = ('user', 'mobile', 'location', 'photo')
from django.contrib import admin

# Register your models here.
