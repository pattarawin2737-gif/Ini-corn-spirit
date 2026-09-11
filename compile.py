import os
import re

# Paths
root = "/Users/pattarawin/Desktop/Project/ProJect Web สุรา"
public_dir = os.path.join(root, "public")
os.makedirs(public_dir, exist_ok=True)

index_src = os.path.join(root, "index.html")
css_src = os.path.join(root, "css.html")
js_src = os.path.join(root, "js.html")

index_dest = os.path.join(public_dir, "index.html")
css_dest = os.path.join(public_dir, "css.css")
js_dest = os.path.join(public_dir, "js.js")

# 1. Compile CSS
with open(css_src, "r", encoding="utf-8") as f:
    css_content = f.read()
# Strip <style> and </style>
css_content = re.sub(r'</?style.*?>', '', css_content, flags=re.IGNORECASE).strip()
with open(css_dest, "w", encoding="utf-8") as f:
    f.write(css_content)
print("CSS compiled successfully to public/css.css")

# 2. Compile JS
with open(js_src, "r", encoding="utf-8") as f:
    js_content = f.read()
# Strip <script> and </script>
js_content = re.sub(r'</?script.*?>', '', js_content, flags=re.IGNORECASE).strip()

# Compatibility Bridge
bridge = """// Google script run REST API Bridge for Cloudflare Pages
function createApiWrapper(successCb, failureCb) {
  const endpoints = [
    'getBatches', 'saveBatch', 'updateBatchStatus', 'deleteBatch',
    'validateLogin', 'registerUser', 'getSpreadsheetInfo', 'getDashboardData',
    'saveDashboardData', 'getChecklistTemplate', 'saveChecklistTemplate',
    'getIngredientStock', 'saveIngredientItem', 'adjustIngredientQuantity', 'deleteIngredientItem',
    'getIngredientUnits', 'addIngredientUnit', 'deleteIngredientUnit',
    'getStockMovements', 'saveStockMovement', 'deleteStockMovement',
    'adminGetUsers', 'adminSaveUser', 'adminDeleteUser',
    'getSystemSettings', 'saveSystemSettings', 'sendTelegramNotification', 'deductBatchStock',
    'checkDueBatches', 'setupDailyTelegramTrigger'
  ];
  const api = {};
  endpoints.forEach(name => {
    api[name] = function(...args) {
      fetch('/api/' + name, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args: args })
      })
      .then(async res => {
        let data = null;
        try {
          data = await res.json();
        } catch(e) {
          data = null;
        }
        if (!res.ok) {
          const errMsg = (data && data.error) ? data.error : ("HTTP Error " + res.status);
          throw new Error(errMsg);
        }
        return data;
      })
      .then(data => {
        if (successCb) successCb(data);
      })
      .catch(err => {
        const errorMsg = (err && err.message) ? err.message : String(err);
        if (failureCb) failureCb({ message: errorMsg });
      });
    };
  });
  return api;
}

const defaultApiHandlers = createApiWrapper(function(){}, function(err){ console.warn("API Warning:", err); });

window.google = {
  script: {
    run: {
      withSuccessHandler: function(successCb) {
        return {
          withFailureHandler: function(failureCb) {
            return createApiWrapper(successCb, failureCb);
          },
          ...createApiWrapper(successCb, function(err) { console.error("GAS Failure:", err); })
        };
      },
      withFailureHandler: function(failureCb) {
        return {
          withSuccessHandler: function(successCb) {
            return createApiWrapper(successCb, failureCb);
          },
          ...createApiWrapper(function(){}, failureCb)
        };
      },
      ...defaultApiHandlers
    }
  }
};

"""

full_js = bridge + js_content
with open(js_dest, "w", encoding="utf-8") as f:
    f.write(full_js)
print("JS compiled successfully to public/js.js")

# 3. Compile Index HTML
with open(index_src, "r", encoding="utf-8") as f:
    index_content = f.read()

# Replace Apps Script templates with static link/script references (with cache-busting timestamp)
import time
build_id = int(time.time())
index_content = index_content.replace("<?!= include('css'); ?>", f'<link rel="stylesheet" href="css.css?v={build_id}">')
index_content = index_content.replace("<?!= include('js'); ?>", f'<script src="js.js?v={build_id}" defer></script>')

with open(index_dest, "w", encoding="utf-8") as f:
    f.write(index_content)
print("HTML entrypoint compiled successfully to public/index.html")
print("Compilation complete!")
