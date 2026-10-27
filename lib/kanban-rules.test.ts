import test from 'node:test';
import assert from 'node:assert/strict';
import { filterLinks, moveAndReorderLinks, sortLaneLinks } from './kanban-rules';
import { Folder, LinkItem, LinkStatus } from './types';

function makeFixtureLinks(): LinkItem[] {
  return [
    {
      id: 'link-1',
      user_id: 'u-1',
      folder_id: 'f-sub',
      url: 'https://example.com/1',
      domain: 'example.com',
      title: 'First Unread Article',
      description: 'Desc 1',
      image_url: null,
      favicon: 'https://example.com/favicon.ico',
      status: LinkStatus.UNREAD,
      order_index: 0,
      reading_minutes: 5,
      tags: ['systems', 'rust'],
      scrape_status: 'ok',
      created_at: '2026-10-20T00:00:00.000Z',
      updated_at: '2026-10-20T00:00:00.000Z',
    },
    {
      id: 'link-2',
      user_id: 'u-1',
      folder_id: 'f-root',
      url: 'https://example.com/2',
      domain: 'example.com',
      title: 'Second Unread Article',
      description: 'Desc 2',
      image_url: null,
      favicon: 'https://example.com/favicon.ico',
      status: LinkStatus.UNREAD,
      order_index: 1,
      reading_minutes: 8,
      tags: ['design'],
      scrape_status: 'ok',
      created_at: '2026-10-21T00:00:00.000Z',
      updated_at: '2026-10-21T00:00:00.000Z',
    },
    {
      id: 'link-3',
      user_id: 'u-1',
      folder_id: 'f-root',
      url: 'https://example.com/3',
      domain: 'example.com',
      title: 'Third Unread Article',
      description: 'Desc 3',
      image_url: null,
      favicon: 'https://example.com/favicon.ico',
      status: LinkStatus.UNREAD,
      order_index: 2,
      reading_minutes: 4,
      tags: ['systems'],
      scrape_status: 'ok',
      created_at: '2026-10-22T00:00:00.000Z',
      updated_at: '2026-10-22T00:00:00.000Z',
    },
  ];
}

test('reorders items within the same lane and keeps contiguous order_index values', () => {
  const initial = makeFixtureLinks();
  // Move link-3 to the top (index 0) of UNREAD lane
  const updated = moveAndReorderLinks(initial, 'link-3', LinkStatus.UNREAD, 0);
  const unread = sortLaneLinks(updated, LinkStatus.UNREAD);

  assert.deepEqual(
    unread.map((l) => ({ id: l.id, order_index: l.order_index })),
    [
      { id: 'link-3', order_index: 0 },
      { id: 'link-1', order_index: 1 },
      { id: 'link-2', order_index: 2 },
    ]
  );
});

test('moves a card to an empty lane with order_index 0 and re-indexes source lane', () => {
  const initial = makeFixtureLinks();
  // ARCHIVED lane is initially empty
  const updated = moveAndReorderLinks(initial, 'link-2', LinkStatus.ARCHIVED, 0);

  const unread = sortLaneLinks(updated, LinkStatus.UNREAD);
  const archived = sortLaneLinks(updated, LinkStatus.ARCHIVED);

  assert.equal(archived.length, 1);
  assert.equal(archived[0].id, 'link-2');
  assert.equal(archived[0].status, LinkStatus.ARCHIVED);
  assert.equal(archived[0].order_index, 0);

  assert.deepEqual(
    unread.map((l) => ({ id: l.id, order_index: l.order_index })),
    [
      { id: 'link-1', order_index: 0 },
      { id: 'link-3', order_index: 1 },
    ]
  );
});

test('filters links recursively across nested child folders and tags', () => {
  const folders: Folder[] = [
    { id: 'f-root', user_id: 'u-1', name: 'Engineering', parent_id: null, order_index: 0 },
    { id: 'f-sub', user_id: 'u-1', name: 'Distributed', parent_id: 'f-root', order_index: 0 },
  ];
  const links = makeFixtureLinks();

  // Selecting parent folder f-root includes links in f-sub as well
  const rootFiltered = filterLinks(links, folders, {
    folderId: 'f-root',
    tag: null,
    searchQuery: '',
  });
  assert.equal(rootFiltered.length, 3);

  // Selecting child folder f-sub only returns link-1
  const subFiltered = filterLinks(links, folders, {
    folderId: 'f-sub',
    tag: null,
    searchQuery: '',
  });
  assert.equal(subFiltered.length, 1);
  assert.equal(subFiltered[0].id, 'link-1');
});
