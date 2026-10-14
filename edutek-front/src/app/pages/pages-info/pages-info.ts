import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon/icon';

type Sujet = 'guide' | 'confidentialite' | 'contact';

/** Pages d'information : guide d'utilisation, confidentialité des données, contact. */
@Component({
  selector: 'app-pages-info',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  templateUrl: './pages-info.html',
  styleUrls: ['../../shared/ui.scss', './pages-info.scss'],
})
export class PagesInfo {
  protected readonly sujet: Sujet = inject(ActivatedRoute).snapshot.data['sujet'] ?? 'guide';
}
