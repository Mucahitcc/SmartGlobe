using System;
using System.Windows.Forms;
using Microsoft.Web.WebView2.WinForms;

namespace SmartGlobe
{
    public partial class Form1 : Form
    {
        
        public Form1()
        {
            InitializeComponent();

            // sayfa yükleme işlemi
            this.Load += Form1_Load;
        }

        private async void Form1_Load(object sender, EventArgs e)
        {
            await webView21.EnsureCoreWebView2Async(null);

            // f12 geliştirici araçlari kapat
            webView21.CoreWebView2.Settings.AreDevToolsEnabled = false;

            // sağ tık menüyü kapat
            webView21.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;

            // login sayfasını aç
            webView21.CoreWebView2.Navigate("http://localhost/smartglobe/login.html");
        }
    }
}