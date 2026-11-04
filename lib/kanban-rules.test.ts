import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clusterGroupLinksBySource,
  consolidateLinksAcrossGroups,
  deduplicateLinks,
  findDuplicateLinkByUrl,
  findExistingGroupForLinkSource,
  getDescendantFolderIds,
  moveAndReorderGroupLinks,
  sortGroupLinks,
} from './kanban-rules';
import { Folder, LinkItem, LinkStatus } from './types';
import {
  containsCJK,
  detectCJKScriptKind,
  normalizeCJKDialectPhrases,
} from './cjk-translate';

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
      url: 'https://github.com/2',
      domain: 'github.com',
      title: 'Second Unread Article',
      description: 'Desc 2',
      image_url: null,
      favicon: 'https://github.com/favicon.ico',
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
      url: 'https://linear.app/3',
      domain: 'linear.app',
      title: 'Third Unread Article',
      description: 'Desc 3',
      image_url: null,
      favicon: 'https://linear.app/favicon.ico',
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

test('reorders links between different Kanban group lanes and within the same group lane', () => {
  const initial = makeFixtureLinks();

  // Move link-1 from f-sub to before link-3 in f-root
  const movedAcross = moveAndReorderGroupLinks(initial, {
    linkId: 'link-1',
    targetFolderId: 'f-root',
    targetLinkId: 'link-3',
    position: 'before',
  });

  const fSubLinks = sortGroupLinks(
    movedAcross.filter((l) => l.folder_id === 'f-sub')
  );
  const fRootLinks = sortGroupLinks(
    movedAcross.filter((l) => l.folder_id === 'f-root')
  );

  assert.equal(fSubLinks.length, 0);
  assert.deepEqual(
    fRootLinks.map((l) => ({ id: l.id, order_index: l.order_index })),
    [
      { id: 'link-2', order_index: 0 },
      { id: 'link-1', order_index: 1 },
      { id: 'link-3', order_index: 2 },
    ]
  );

  // Reorder link-3 to before link-2 within f-root
  const reorderedSameLane = moveAndReorderGroupLinks(movedAcross, {
    linkId: 'link-3',
    targetFolderId: 'f-root',
    targetLinkId: 'link-2',
    position: 'before',
  });

  const fRootReordered = sortGroupLinks(
    reorderedSameLane.filter((l) => l.folder_id === 'f-root')
  );
  assert.deepEqual(
    fRootReordered.map((l) => ({ id: l.id, order_index: l.order_index })),
    [
      { id: 'link-3', order_index: 0 },
      { id: 'link-2', order_index: 1 },
      { id: 'link-1', order_index: 2 },
    ]
  );

  const clustered = clusterGroupLinksBySource(fRootReordered);
  assert.deepEqual(
    clustered.items.map((entry) =>
      entry.type === 'link' ? entry.link.id : entry.subGroup.key
    ),
    ['link-3', 'link-2', 'link-1']
  );
});

test('resolves descendant folder IDs recursively across nested child folders', () => {
  const folders: Folder[] = [
    { id: 'f-root', user_id: 'u-1', name: 'Engineering', parent_id: null, order_index: 0 },
    { id: 'f-sub', user_id: 'u-1', name: 'Distributed', parent_id: 'f-root', order_index: 0 },
  ];

  const rootDescendants = getDescendantFolderIds(folders, 'f-root');
  assert.deepEqual(Array.from(rootDescendants).sort(), ['f-root', 'f-sub']);

  const subDescendants = getDescendantFolderIds(folders, 'f-sub');
  assert.deepEqual(Array.from(subDescendants), ['f-sub']);
});

test('sorts sub-groups of same YouTube channel or same domain/link on top of standalone links', () => {
  const base = makeFixtureLinks()[0];
  const groupLinks: LinkItem[] = [
    {
      ...base,
      id: 'single-1',
      url: 'https://news.ycombinator.com/item?id=1',
      domain: 'news.ycombinator.com',
      order_index: 0,
    },
    {
      ...base,
      id: 'yt-1',
      url: 'https://www.youtube.com/watch?v=aaa11111111',
      domain: 'youtube.com',
      channel_name: 'Fireship',
      order_index: 1,
    },
    {
      ...base,
      id: 'single-2',
      url: 'https://vercel.com/blog',
      domain: 'vercel.com',
      order_index: 2,
    },
    {
      ...base,
      id: 'yt-2',
      url: 'https://www.youtube.com/watch?v=bbb22222222',
      domain: 'youtube.com',
      channel_name: 'Fireship',
      order_index: 3,
    },
    {
      ...base,
      id: 'gh-1',
      url: 'https://github.com/facebook/react',
      domain: 'github.com',
      order_index: 4,
    },
    {
      ...base,
      id: 'gh-2',
      url: 'https://github.com/vercel/next.js',
      domain: 'github.com',
      order_index: 5,
    },
  ];

  const clustered = clusterGroupLinksBySource(groupLinks);

  assert.deepEqual(
    clustered.items.map((entry) =>
      entry.type === 'subgroup' ? entry.subGroup.key : entry.link.id
    ),
    [
      'yt-channel:fireship',
      'domain:github.com',
      'single-1',
      'single-2',
    ]
  );
});

test('consolidates a new tab from "youtube" group into "learn" group when they share the same YouTube channel or domain', () => {
  const base = makeFixtureLinks()[0];
  const folders: Folder[] = [
    {
      id: 'fld-learn',
      user_id: 'u-1',
      name: 'learn',
      parent_id: null,
      order_index: 0,
    },
    {
      id: 'fld-youtube',
      user_id: 'u-1',
      name: 'youtube',
      parent_id: null,
      order_index: 1,
    },
  ];

  const existingInLearn: LinkItem = {
    ...base,
    id: 'yt-learn-1',
    folder_id: 'fld-learn',
    url: 'https://www.youtube.com/watch?v=learn111111',
    domain: 'youtube.com',
    channel_name: '3Blue1Brown',
    order_index: 0,
    created_at: '2026-10-25T10:00:00.000Z',
  };

  const newInYouTubeGroup: LinkItem = {
    ...base,
    id: 'yt-new-2',
    folder_id: 'fld-youtube',
    url: 'https://www.youtube.com/watch?v=new22222222',
    domain: 'youtube.com',
    channel_name: '3Blue1Brown',
    order_index: 0,
    created_at: '2026-10-25T11:00:00.000Z',
  };

  const matchedFolder = findExistingGroupForLinkSource(
    newInYouTubeGroup,
    [existingInLearn],
    folders
  );
  assert.equal(matchedFolder, 'fld-learn');

  const consolidated = consolidateLinksAcrossGroups(
    [existingInLearn, newInYouTubeGroup],
    folders
  );
  assert.equal(consolidated.movedLinks.length, 1);
  assert.deepEqual(consolidated.movedLinks[0], {
    linkId: 'yt-new-2',
    fromFolderId: 'fld-youtube',
    toFolderId: 'fld-learn',
  });
  assert.ok(
    consolidated.links.every((item) => item.folder_id === 'fld-learn')
  );
});

test('detects Chinese, Korean, and Japanese characters and normalizes regional dialects', () => {
  assert.equal(containsCJK('點解佢哋唔返工？ - Cantonese Vlog'), true);
  assert.equal(detectCJKScriptKind('點解佢哋唔返工？'), 'chinese');
  assert.equal(
    normalizeCJKDialectPhrases('點解佢哋唔返工'),
    '为什么他们不上班'
  );

  assert.equal(containsCJK('부산 사투리 억수로 재밌네 - YouTube'), true);
  assert.equal(detectCJKScriptKind('부산 사투리 억수로 재밌네'), 'korean');

  assert.equal(containsCJK('関西弁ほんまにめっちゃ好き！'), true);
  assert.equal(detectCJKScriptKind('関西弁ほんまにめっちゃ好き！'), 'japanese');

  assert.equal(
    containsCJK('Tối ưu hóa React 19 và Next.js App Router'),
    false
  );
});

test('removes old and new duplicate tabs across groups and merges resolved metadata into the kept tab', () => {
  const base = makeFixtureLinks()[0];
  const folders: Folder[] = [
    {
      id: 'fld-learn',
      user_id: 'u-1',
      name: 'learn',
      parent_id: null,
      order_index: 0,
    },
    {
      id: 'fld-youtube',
      user_id: 'u-1',
      name: 'youtube',
      parent_id: null,
      order_index: 1,
    },
  ];

  const oldTabUnresolved: LinkItem = {
    ...base,
    id: 'yt-old-1',
    folder_id: 'fld-learn',
    url: 'https://youtu.be/abc12345678?si=tracking1',
    domain: 'youtu.be',
    title: 'YouTube',
    channel_name: null,
    video_duration: null,
    order_index: 0,
    created_at: '2026-10-20T09:00:00.000Z',
  };

  const newTabResolvedDuplicate: LinkItem = {
    ...base,
    id: 'yt-new-dup-2',
    folder_id: 'fld-youtube',
    url: 'https://www.youtube.com/watch?v=abc12345678&utm_source=share',
    domain: 'youtube.com',
    title: 'How Transformers Work Visually',
    channel_name: '3Blue1Brown',
    video_duration: '27:14',
    order_index: 0,
    created_at: '2026-10-25T12:00:00.000Z',
  };

  const foundDup = findDuplicateLinkByUrl(
    'https://youtube.com/watch?v=abc12345678',
    [oldTabUnresolved, newTabResolvedDuplicate],
    folders
  );
  // Also matches scheme-less URL input (e.g. typed into AddLinkModal without https://)
  const foundSchemeLessDup = findDuplicateLinkByUrl(
    'youtube.com/watch?v=abc12345678',
    [oldTabUnresolved, newTabResolvedDuplicate],
    folders
  );
  assert.equal(foundDup?.id, 'yt-old-1');
  assert.equal(foundSchemeLessDup?.id, 'yt-old-1');

  const deduped = deduplicateLinks(
    [oldTabUnresolved, newTabResolvedDuplicate],
    folders
  );
  assert.equal(deduped.links.length, 1);
  assert.equal(deduped.removedLinks.length, 1);
  assert.equal(deduped.removedLinks[0].id, 'yt-new-dup-2');
  assert.equal(deduped.links[0].id, 'yt-old-1');
  assert.equal(deduped.links[0].title, 'How Transformers Work Visually');
  assert.equal(deduped.links[0].channel_name, '3Blue1Brown');
  assert.equal(deduped.links[0].video_duration, '27:14');

  const consolidated = consolidateLinksAcrossGroups(
    [oldTabUnresolved, newTabResolvedDuplicate],
    folders
  );
  assert.equal(consolidated.links.length, 1);
  assert.equal(consolidated.removedDuplicateLinks.length, 1);
  assert.equal(consolidated.removedDuplicateLinks[0].id, 'yt-new-dup-2');
});






