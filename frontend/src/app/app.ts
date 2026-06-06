import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly apiStatus = signal<'loading' | 'online' | 'offline'>('loading');
  protected readonly statusLabel = computed(() => {
    const labels = {
      loading: 'Connexion à l’API…',
      online: 'API Express connectée',
      offline: 'API Express indisponible'
    };

    return labels[this.apiStatus()];
  });

  ngOnInit(): void {
    this.http.get('/api/health').subscribe({
      next: () => this.apiStatus.set('online'),
      error: () => this.apiStatus.set('offline')
    });
  }
}
