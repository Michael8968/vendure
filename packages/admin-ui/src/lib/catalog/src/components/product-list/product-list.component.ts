import { Component, OnInit } from '@angular/core';
import { marker as _ } from '@biesbjerg/ngx-translate-extract-marker';
import {
    DataService,
    FacetValueFormInputComponent,
    JobQueueService,
    JobState,
    LogicalOperator,
    ModalService,
    NotificationService,
    ProductListQueryDocument,
    TypedBaseListComponent,
} from '@vendure/admin-ui/core';
import { EMPTY, lastValueFrom } from 'rxjs';
import { delay, switchMap } from 'rxjs/operators';
// getAppConfig
import { getAppConfig } from '@vendure/admin-ui/core';
@Component({
    selector: 'vdr-products-list',
    templateUrl: './product-list.component.html',
    styleUrls: ['./product-list.component.scss'],
})
export class ProductListComponent
    extends TypedBaseListComponent<typeof ProductListQueryDocument, 'products'>
    implements OnInit
{
    pendingSearchIndexUpdates = 0;
    readonly customFields = this.getCustomFieldConfig('Product');
    readonly filters = this.createFilterCollection()
        .addIdFilter()
        .addDateFilters()
        .addFilters([
            {
                name: 'enabled',
                type: { kind: 'boolean' },
                label: _('common.enabled'),
                filterField: 'enabled',
            },
            {
                name: 'slug',
                type: { kind: 'text' },
                label: _('common.slug'),
                filterField: 'slug',
            },
        ])
        .addFilter({
            name: 'facetValues',
            type: {
                kind: 'custom',
                component: FacetValueFormInputComponent,
                serializeValue: value => value.map(v => v.id).join(','),
                deserializeValue: value => value.split(',').map(id => ({ id })),
                getLabel: value => {
                    if (value.length === 0) {
                        return '';
                    }
                    if (value[0].name) {
                        return value.map(v => v.name).join(', ');
                    } else {
                        return lastValueFrom(
                            this.dataService.facet
                                .getFacetValues({ filter: { id: { in: value.map(v => v.id) } } })
                                .mapSingle(({ facetValues }) =>
                                    facetValues.items.map(fv => fv.name).join(', '),
                                ),
                        );
                    }
                },
            },
            label: _('catalog.facet-values'),
            toFilterInput: (value: any[]) => ({
                facetValueId: {
                    in: value.map(v => v.id),
                },
            }),
        })
        .addCustomFieldFilters(this.customFields)
        .connectToRoute(this.route);

    readonly sorts = this.createSortCollection()
        .defaultSort('createdAt', 'DESC')
        .addSorts([
            { name: 'id' },
            { name: 'createdAt' },
            { name: 'updatedAt' },
            { name: 'name' },
            { name: 'slug' },
        ])
        .addCustomFieldSorts(this.customFields)
        .connectToRoute(this.route);

    constructor(
        protected dataService: DataService,
        private modalService: ModalService,
        private notificationService: NotificationService,
        private jobQueueService: JobQueueService,
    ) {
        super();
        this.configure({
            document: ProductListQueryDocument,
            getItems: data => data.products,
            setVariables: (skip, take) => {
                const searchTerm = this.searchTermControl.value;
                let filterInput = this.filters.createFilterInput();
                if (searchTerm) {
                    filterInput = {
                        name: {
                            contains: searchTerm,
                        },
                        sku: {
                            contains: searchTerm,
                        },
                    };
                }
                return {
                    options: {
                        skip,
                        take,
                        filter: {
                            ...(filterInput ?? {}),
                        },
                        filterOperator: searchTerm ? LogicalOperator.OR : LogicalOperator.AND,
                        sort: this.sorts.createSortInput(),
                    },
                };
            },
            refreshListOnChanges: [this.sorts.valueChanges, this.filters.valueChanges],
        });
    }

    rebuildSearchIndex() {
        this.dataService.product.reindex().subscribe(({ reindex }) => {
            this.notificationService.info(_('catalog.reindexing'));
            this.jobQueueService.addJob(reindex.id, job => {
                if (job.state === JobState.COMPLETED) {
                    const time = new Intl.NumberFormat().format(job.duration || 0);
                    this.notificationService.success(_('catalog.reindex-successful'), {
                        count: job.result.indexedItemCount,
                        time,
                    });
                    this.refresh();
                } else {
                    this.notificationService.error(_('catalog.reindex-error'));
                }
            });
        });
    }

    deleteProduct(productId: string) {
        this.modalService
            .dialog({
                title: _('catalog.confirm-delete-product'),
                buttons: [
                    { type: 'secondary', label: _('common.cancel') },
                    { type: 'danger', label: _('common.delete'), returnValue: true },
                ],
            })
            .pipe(
                switchMap(response => (response ? this.dataService.product.deleteProduct(productId) : EMPTY)),
                // Short delay to allow the product to be removed from the search index before
                // refreshing.
                delay(500),
            )
            .subscribe(
                () => {
                    this.notificationService.success(_('common.notify-delete-success'), {
                        entity: 'Product',
                    });
                    this.refresh();
                },
                err => {
                    this.notificationService.error(_('common.notify-delete-error'), {
                        entity: 'Product',
                    });
                },
            );
    }
    designPage: Window | null = null;
    openDesignPage() {
        // open http://localhost:3001/ and send message to it, if opened, use postMessage to send message to it
        this.designPage = window.open('http://localhost:3001/', 'designTab');
        if (this.designPage) {
            // listen to message from designPage
            window.addEventListener('message', this.onMessageFromDesignPage.bind(this));
        }
    }

    onMessageFromDesignPage(event: MessageEvent) {
        // ignore message from self
        if (event.source === window) {
            return;
        }
        console.log('message from designPage', event, event.data, event.source, this.designPage);
        if (event.data.type === 'ready' && event.source && this.designPage) {
            // send vnd__authToken to designPage
            const authToken = localStorage.getItem('vnd__authToken');
            // vnd__activeChannelToken
            const activeChannelToken = localStorage.getItem('vnd__activeChannelToken');
            const appConfig = getAppConfig();
            if (authToken) {
                const message = {
                    type: 'authToken',
                    token: authToken,
                    appConfig: appConfig,
                    activeChannelToken: activeChannelToken,
                };
                this.designPage.postMessage(message, '*');
                console.log('sent authToken to designPage', message);
            }
            // const credentials = this.dataService.auth.getLoginCredentials();
            // if (credentials.username && credentials.password) {
            //     const message = {
            //         type: 'login',
            //         username: credentials.username,
            //         password: credentials.password,
            //     };
            //     this.designPage.postMessage(message, '*');
            // }
        }
        if (event.data.type === 'getProductList') {
            this.dataService.product.getProducts({ take: 10 }).single$.subscribe(data => {
                const message = {
                    type: 'productList',
                    productList: data.products,
                };
                this.designPage?.postMessage(message, '*');
            });
        }
    }
}
