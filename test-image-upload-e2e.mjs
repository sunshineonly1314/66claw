#!/usr/bin/env node
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const testBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

async function testImageUpload() {
  console.log('🚀 Starting OpenClawCN Image Upload E2E Test...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  try {
    // 1. 访问页面
    console.log('📍 Step 1: Navigate to http://localhost:3333');
    await page.goto('http://localhost:3333', { waitUntil: 'networkidle', timeout: 10000 });
    await page.screenshot({ path: 'test-screenshots/01-homepage.png' });
    results.passed.push('✅ Page loaded successfully');

    // 2. 检查页面标题
    const title = await page.title();
    console.log(`   Title: ${title}`);

    // 3. 等待聊天框加载
    console.log('\n📍 Step 2: Wait for chat interface');
    await page.waitForSelector('textarea, [contenteditable="true"]', { timeout: 5000 });
    results.passed.push('✅ Chat interface loaded');

    // 4. 查找聊天输入框
    console.log('\n📍 Step 3: Find chat input');
    const chatInput = await page.locator('textarea[placeholder*="输入"], textarea[placeholder*="message"], [role="textbox"]').first();
    const inputExists = await chatInput.count() > 0;
    if (inputExists) {
      results.passed.push('✅ Chat input found');
      console.log('   ✓ Chat input element located');
    } else {
      results.failed.push('❌ Chat input not found');
      console.log('   ✗ Chat input element NOT found');
    }

    // 5. 检查 📎 上传按钮
    console.log('\n📍 Step 4: Check for attach button (📎)');
    const attachBtn = await page.locator('button.chat-attach-btn, button[title*="Attach"], button[aria-label*="Attach"]').first();
    const attachBtnExists = await attachBtn.count() > 0;
    if (attachBtnExists) {
      results.passed.push('✅ Attach button (📎) found');
      console.log('   ✓ Attach button located');

      // 检查按钮文本/图标
      const btnText = await attachBtn.textContent();
      console.log(`   Button content: "${btnText}"`);

      await page.screenshot({ path: 'test-screenshots/02-attach-button.png' });
    } else {
      results.failed.push('❌ Attach button (📎) NOT found');
      console.log('   ✗ Attach button NOT located');
    }

    // 6. 检查隐藏的文件输入框
    console.log('\n📍 Step 5: Check for file input element');
    const fileInput = await page.locator('input[type="file"]#chat-file-input, input[type="file"][accept*="image"]').first();
    const fileInputExists = await fileInput.count() > 0;
    if (fileInputExists) {
      results.passed.push('✅ File input element found');
      console.log('   ✓ File input element located');

      const accept = await fileInput.getAttribute('accept');
      console.log(`   Accept attribute: ${accept}`);

      if (accept && accept.includes('image')) {
        results.passed.push('✅ File input accepts images');
      } else {
        results.warnings.push('⚠️ File input accept attribute may not include images');
      }
    } else {
      results.failed.push('❌ File input element NOT found');
      console.log('   ✗ File input element NOT located');
    }

    // 7. 测试粘贴 Base64 图片
    console.log('\n📍 Step 6: Test pasting Base64 image');
    if (inputExists) {
      try {
        // 聚焦输入框
        await chatInput.click();

        // 模拟粘贴事件
        await page.evaluate((base64) => {
          const input = document.querySelector('textarea[placeholder*="输入"], textarea[placeholder*="message"], [role="textbox"]');
          if (input) {
            // 创建粘贴事件
            const clipboardData = new DataTransfer();
            clipboardData.items.add(base64, 'text/plain');

            const pasteEvent = new ClipboardEvent('paste', {
              clipboardData: clipboardData,
              bubbles: true,
              cancelable: true
            });

            input.dispatchEvent(pasteEvent);
          }
        }, testBase64);

        // 等待预览出现
        await page.waitForTimeout(1000);

        // 检查是否有图片预览
        const preview = await page.locator('.chat-attachments, .chat-attachment, img[alt*="preview"], img[alt*="Attachment"]').first();
        const previewExists = await preview.count() > 0;

        if (previewExists) {
          results.passed.push('✅ Base64 paste works - preview appeared');
          console.log('   ✓ Image preview appeared after paste');
          await page.screenshot({ path: 'test-screenshots/03-base64-preview.png' });
        } else {
          results.failed.push('❌ Base64 paste - no preview appeared');
          console.log('   ✗ No image preview after paste');
        }
      } catch (err) {
        results.failed.push(`❌ Base64 paste test error: ${err.message}`);
        console.log(`   ✗ Error: ${err.message}`);
      }
    }

    // 8. 检查 handlePaste 函数（通过控制台）
    console.log('\n📍 Step 7: Check for handlePaste function in page');
    const hasHandlePaste = await page.evaluate(() => {
      const scripts = Array.from(document.scripts);
      for (const script of scripts) {
        if (script.textContent && script.textContent.includes('handlePaste')) {
          return true;
        }
      }
      // 检查外部脚本
      return window.__hasImageUpload || false;
    });

    if (hasHandlePaste) {
      results.passed.push('✅ handlePaste function detected in page scripts');
    } else {
      results.warnings.push('⚠️ handlePaste function not detected (may be in external bundle)');
    }

    // 9. 最终截图
    await page.screenshot({ path: 'test-screenshots/04-final-state.png', fullPage: true });

  } catch (error) {
    results.failed.push(`❌ Test error: ${error.message}`);
    console.error('\n❌ Error during test:', error.message);
    await page.screenshot({ path: 'test-screenshots/error.png' });
  } finally {
    await browser.close();
  }

  // 打印测试结果
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS');
  console.log('='.repeat(60));

  console.log(`\n✅ PASSED (${results.passed.length}):`);
  results.passed.forEach(r => console.log('  ' + r));

  if (results.warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${results.warnings.length}):`);
    results.warnings.forEach(r => console.log('  ' + r));
  }

  if (results.failed.length > 0) {
    console.log(`\n❌ FAILED (${results.failed.length}):`);
    results.failed.forEach(r => console.log('  ' + r));
  }

  console.log('\n' + '='.repeat(60));

  const totalTests = results.passed.length + results.failed.length;
  const passRate = ((results.passed.length / totalTests) * 100).toFixed(1);

  console.log(`\n📈 Pass Rate: ${passRate}% (${results.passed.length}/${totalTests})`);

  if (results.failed.length === 0) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('✅ Image upload functionality is WORKING!');
  } else {
    console.log('\n⚠️  Some tests failed. See details above.');
  }

  console.log('\n📸 Screenshots saved to: test-screenshots/');

  // 保存结果到文件
  writeFileSync('test-results.json', JSON.stringify(results, null, 2));
  console.log('📄 Results saved to: test-results.json\n');

  return results.failed.length === 0;
}

// 运行测试
testImageUpload().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
