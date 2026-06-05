import subprocess


def test_print_node_version():
    try:
        out = subprocess.check_output(["node", "--version"], stderr=subprocess.STDOUT, text=True)
        print("node --version =", out.strip())
    except Exception as e:
        print("node not found or error:", e)
