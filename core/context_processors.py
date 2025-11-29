from django.conf import settings

def global_settings(request):
    return {
        'PROJECT_NAME': 'Ландыш',
        'RAC_PATH': settings.RAC_PATH,
    }